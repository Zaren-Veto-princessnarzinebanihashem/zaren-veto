import Common "../types/common";
import Types "../types/groups";
import UPMTypes "../types/users-posts-messages";
import Lib "../lib/groups";
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Int "mo:core/Int";

/// Mixin exposing all public group endpoints.
/// State slices are injected at construction time from main.mo.
mixin (
  groups     : Map.Map<Types.GroupId, Types.Group>,
  nextGroupId : { var value : Nat },
  // Users map needed to look up usernames for invite
  users      : Map.Map<Common.UserId, UPMTypes.User>,
  // Group posts: groupId -> list of GroupPost
  groupPosts      : Map.Map<Types.GroupId, List.List<Types.GroupPost>>,
  nextGroupPostId : { var value : Nat },
  // Group post likes: groupPostId -> list of userIds who liked
  groupPostLikes  : Map.Map<Types.GroupPostId, List.List<Common.UserId>>,
) {

  // ─── Create ─────────────────────────────────────────────────────────────────────

  /// Create a new group. Caller must be authenticated.
  /// Returns the GroupView of the created group.
  public shared ({ caller }) func createGroup(
    name          : Text,
    description   : Text,
    isPrivate     : Bool,
    coverImageData : ?Text,
  ) : async Types.CreateGroupResult {
    if (caller.isAnonymous()) return #err("Must be logged in to create a group");
    if (name.size() == 0) return #err("Group name cannot be empty");

    // Resolve caller's username
    let ownerUsername = switch (users.get(caller)) {
      case (?u) u.username;
      case null return #err("User not registered");
    };

    let id = nextGroupId.value;
    nextGroupId.value += 1;
    let now = Time.now();

    let creatorMember : Types.GroupMember = {
      userId   = caller;
      username = ownerUsername;
      joinedAt = now;
    };

    let memberList = List.empty<Types.GroupMember>();
    memberList.add(creatorMember);

    let group : Types.Group = {
      id;
      var name;
      var description;
      var coverImageData;
      var coverImageUrl = null;
      var isPrivate;
      ownerId       = caller;
      ownerUsername;
      members       = memberList;
      createdAt     = now;
    };

    groups.add(id, group);
    // Initialize empty post list for this group
    groupPosts.add(id, List.empty<Types.GroupPost>());
    #ok(Lib.groupToView(group, caller));
  };

  // ─── Read ─────────────────────────────────────────────────────────────────────

  /// Return all groups, with isMember flag for the caller. Limited to 50.
  public shared query ({ caller }) func getGroups() : async [Types.GroupView] {
    let result = List.empty<Types.GroupView>();
    for ((_, group) in groups.entries()) {
      if (result.size() >= 50) return result.toArray();
      result.add(Lib.groupToView(group, caller));
    };
    result.toArray();
  };

  /// Return paginated groups.
  public shared query ({ caller }) func getGroupsPaginated(offset : Nat, limit : Nat) : async [Types.GroupView] {
    let safeLimit = if (limit > 50) 50 else limit;
    let result = List.empty<Types.GroupView>();
    var skipped : Nat = 0;
    for ((_, group) in groups.entries()) {
      if (result.size() >= safeLimit) return result.toArray();
      if (skipped < offset) {
        skipped += 1;
      } else {
        result.add(Lib.groupToView(group, caller));
      };
    };
    result.toArray();
  };

  /// Return only the groups the caller is a member of.
  public shared query ({ caller }) func getMyGroups() : async [Types.GroupView] {
    let result = List.empty<Types.GroupView>();
    for ((_, group) in groups.entries()) {
      if (result.size() >= 100) return result.toArray();
      let view = Lib.groupToView(group, caller);
      if (view.isMember) {
        result.add(view);
      };
    };
    result.toArray();
  };

  /// Get a single group by ID.
  public shared query ({ caller }) func getGroup(groupId : Types.GroupId) : async ?Types.GroupView {
    switch (groups.get(groupId)) {
      case null null;
      case (?g) ?Lib.groupToView(g, caller);
    };
  };

  // ─── Join / Leave ──────────────────────────────────────────────────────────────────

  /// Join a group as the calling user.
  public shared ({ caller }) func joinGroup(groupId : Types.GroupId) : async Types.JoinLeaveGroupResult {
    if (caller.isAnonymous()) return #err("Must be logged in to join a group");
    switch (groups.get(groupId)) {
      case null { #err("Group not found") };
      case (?group) {
        let existing = group.members.find(func(m : Types.GroupMember) : Bool {
          Principal.equal(m.userId, caller)
        });
        if (existing != null) return #err("Already a member of this group");
        let username = switch (users.get(caller)) {
          case (?u) u.username;
          case null return #err("User not registered");
        };
        let newMember : Types.GroupMember = {
          userId   = caller;
          username;
          joinedAt = Time.now();
        };
        group.members.add(newMember);
        #ok(true);
      };
    };
  };

  /// Leave a group. The owner cannot leave (must delete instead).
  public shared ({ caller }) func leaveGroup(groupId : Types.GroupId) : async Types.JoinLeaveGroupResult {
    if (caller.isAnonymous()) return #err("Must be logged in to leave a group");
    switch (groups.get(groupId)) {
      case null { #err("Group not found") };
      case (?group) {
        if (Principal.equal(group.ownerId, caller)) {
          return #err("Group owner cannot leave — delete the group instead");
        };
        let before = group.members.size();
        let filtered = group.members.filter(func(m : Types.GroupMember) : Bool {
          not Principal.equal(m.userId, caller)
        });
        if (filtered.size() == before) return #err("Not a member of this group");
        group.members.clear();
        group.members.append(filtered);
        #ok(true);
      };
    };
  };

  // ─── Invite ─────────────────────────────────────────────────────────────────────

  /// Invite a user by username (owner only).
  public shared ({ caller }) func inviteMember(groupId : Types.GroupId, username : Text) : async Types.JoinLeaveGroupResult {
    if (caller.isAnonymous()) return #err("Must be logged in to invite members");
    switch (groups.get(groupId)) {
      case null { #err("Group not found") };
      case (?group) {
        if (not Principal.equal(group.ownerId, caller)) {
          return #err("Only the group owner can invite members");
        };
        // Find the target user by username
        var targetUser : ?UPMTypes.User = null;
        for ((_, u) in users.entries()) {
          if (u.username == username) {
            targetUser := ?u;
          };
        };
        switch (targetUser) {
          case null { #err("User not found: " # username) };
          case (?u) {
            let existing = group.members.find(func(m : Types.GroupMember) : Bool {
              Principal.equal(m.userId, u.id)
            });
            if (existing != null) return #err("User is already a member");
            let newMember : Types.GroupMember = {
              userId   = u.id;
              username = u.username;
              joinedAt = Time.now();
            };
            group.members.add(newMember);
            #ok(true);
          };
        };
      };
    };
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────────

  /// Delete a group. Only the group owner or the app owner may delete.
  public shared ({ caller }) func deleteGroup(groupId : Types.GroupId) : async Bool {
    switch (groups.get(groupId)) {
      case null { false };
      case (?group) {
        // Allow group owner or app owner (Princess Narzine Bani Hashem)
        let isGroupOwner = Principal.equal(group.ownerId, caller);
        let isAppOwner = switch (users.get(caller)) {
          case (?u) u.username == "Princess Narzine Bani Hashem";
          case null false;
        };
        if (not isGroupOwner and not isAppOwner) return false;
        groups.remove(groupId);
        groupPosts.remove(groupId);
        true;
      };
    };
  };

  // ─── Cover image (object-storage URL) ────────────────────────────────────────────

  /// Update the group cover image via object-storage URL. Only the group creator can do this.
  public shared ({ caller }) func updateGroupCoverImage(groupId : Types.GroupId, imageUrl : Text) : async { #ok; #err : Text } {
    switch (groups.get(groupId)) {
      case null { #err("Group not found") };
      case (?group) {
        if (not Principal.equal(group.ownerId, caller)) {
          return #err("Only the group creator can update the cover image");
        };
        group.coverImageUrl := ?imageUrl;
        #ok;
      };
    };
  };

  // ─── Group Posts ───────────────────────────────────────────────────────────────────

  private func buildGroupPostView(post : Types.GroupPost) : Types.GroupPostView {
    let (authorName, authorPhoto, authorVerified) = switch (users.get(post.authorId)) {
      case (?u) (u.username, u.profilePhotoUrl, u.isVerified);
      case null ("", null, false);
    };
    let likesCount = switch (groupPostLikes.get(post.id)) {
      case (?lst) lst.size();
      case null 0;
    };
    {
      id             = post.id;
      groupId        = post.groupId;
      authorId       = post.authorId;
      authorName;
      authorProfilePhoto = authorPhoto;
      authorVerified;
      content        = post.content;
      imageUrl       = post.imageUrl;
      createdAt      = post.createdAt;
      updatedAt      = post.updatedAt;
      likesCount;
      commentsCount  = 0;
    };
  };

  private func isMemberOf(group : Types.Group, userId : Common.UserId) : Bool {
    switch (group.members.find(func(m : Types.GroupMember) : Bool {
      Principal.equal(m.userId, userId)
    })) {
      case (?_) true;
      case null false;
    };
  };

  /// Create a post in a group. Only group members (and owner) may post.
  public shared ({ caller }) func createGroupPost(
    groupId  : Types.GroupId,
    content  : Text,
    imageUrl : ?Text,
  ) : async { #ok : Types.GroupPostId; #err : Text } {
    if (caller.isAnonymous()) return #err("Must be logged in");
    if (content.size() == 0) return #err("Post content cannot be empty");
    switch (groups.get(groupId)) {
      case null { #err("Group not found") };
      case (?group) {
        if (not isMemberOf(group, caller) and not Principal.equal(group.ownerId, caller)) {
          return #err("Only group members can post in this group");
        };
        let id  = nextGroupPostId.value;
        nextGroupPostId.value += 1;
        let now = Time.now();
        let post : Types.GroupPost = {
          id;
          groupId;
          authorId  = caller;
          var content;
          var imageUrl;
          createdAt = now;
          var updatedAt = now;
        };
        let pl = switch (groupPosts.get(groupId)) {
          case (?lst) lst;
          case null {
            let lst = List.empty<Types.GroupPost>();
            groupPosts.add(groupId, lst);
            lst;
          };
        };
        pl.add(post);
        #ok(id);
      };
    };
  };

  /// Get all posts for a group, most recent first. Max 50.
  public shared query ({ caller }) func getGroupPosts(groupId : Types.GroupId) : async [Types.GroupPostView] {
    switch (groupPosts.get(groupId)) {
      case null { [] };
      case (?pl) {
        let sorted = pl.sort(func(a : Types.GroupPost, b : Types.GroupPost) : { #less; #equal; #greater } {
          Int.compare(b.createdAt, a.createdAt);
        });
        let sz    = sorted.size();
        let limit = if (sz > 50) 50 else sz;
        sorted.sliceToArray(0, limit).map<Types.GroupPost, Types.GroupPostView>(func(p) {
          buildGroupPostView(p);
        });
      };
    };
  };

  /// Edit a group post. Only the post author may edit.
  public shared ({ caller }) func editGroupPost(
    groupId    : Types.GroupId,
    postId     : Types.GroupPostId,
    newContent : Text,
  ) : async { #ok; #err : Text } {
    switch (groupPosts.get(groupId)) {
      case null { #err("Group not found") };
      case (?pl) {
        var found = false;
        pl.mapInPlace(func(p : Types.GroupPost) : Types.GroupPost {
          if (p.id == postId and Principal.equal(p.authorId, caller)) {
            p.content   := newContent;
            p.updatedAt := Time.now();
            found := true;
          };
          p;
        });
        if (found) #ok else #err("Post not found or not your post");
      };
    };
  };

  /// Delete a group post. Author or group creator may delete.
  public shared ({ caller }) func deleteGroupPost(
    groupId : Types.GroupId,
    postId  : Types.GroupPostId,
  ) : async { #ok; #err : Text } {
    switch (groups.get(groupId)) {
      case null { #err("Group not found") };
      case (?group) {
        switch (groupPosts.get(groupId)) {
          case null { #err("No posts in this group") };
          case (?pl) {
            let isGroupOwner = Principal.equal(group.ownerId, caller);
            let postExists = pl.find(func(p : Types.GroupPost) : Bool {
              p.id == postId and (Principal.equal(p.authorId, caller) or isGroupOwner)
            });
            switch (postExists) {
              case null { #err("Post not found or permission denied") };
              case (?_) {
                let filtered = pl.filter(func(p : Types.GroupPost) : Bool { p.id != postId });
                pl.clear();
                pl.append(filtered);
                #ok;
              };
            };
          };
        };
      };
    };
  };

  /// Like a group post.
  public shared ({ caller }) func likeGroupPost(
    groupId : Types.GroupId,
    postId  : Types.GroupPostId,
  ) : async { #ok; #err : Text } {
    if (caller.isAnonymous()) return #err("Must be logged in");
    let lst = switch (groupPostLikes.get(postId)) {
      case (?l) l;
      case null {
        let l = List.empty<Common.UserId>();
        groupPostLikes.add(postId, l);
        l;
      };
    };
    let alreadyLiked = lst.find(func(uid : Common.UserId) : Bool { Principal.equal(uid, caller) });
    if (alreadyLiked != null) return #err("Already liked");
    lst.add(caller);
    #ok;
  };

  /// Unlike a group post.
  public shared ({ caller }) func unlikeGroupPost(
    groupId : Types.GroupId,
    postId  : Types.GroupPostId,
  ) : async { #ok; #err : Text } {
    switch (groupPostLikes.get(postId)) {
      case null { #err("Post not liked") };
      case (?lst) {
        let before = lst.size();
        let filtered = lst.filter(func(uid : Common.UserId) : Bool { not Principal.equal(uid, caller) });
        if (filtered.size() == before) return #err("Not liked");
        lst.clear();
        lst.append(filtered);
        #ok;
      };
    };
  };
};
