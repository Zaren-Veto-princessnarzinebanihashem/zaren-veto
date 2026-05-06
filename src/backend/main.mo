import Map "mo:core/Map";
import Set "mo:core/Set";
import List "mo:core/List";
import Principal "mo:core/Principal";

import Common "types/common";
import Types "types/users-posts-messages";
import EngTypes "types/engagement";
import NewTypes "types/stories-hashtags-friendrequests-polls-admin";
import GroupTypes "types/groups";
import PageTypes "types/pages";
import UPMApi "mixins/users-posts-messages-api";
import EngApi "mixins/engagement-api";
import NewApi "mixins/stories-hashtags-friendrequests-polls-admin-api";
import GroupsApi "mixins/groups-api";
import PagesApi "mixins/pages-api";
import UPMLib "lib/users-posts-messages";

// ─────────────────────────────────────────────────────────────────────────────
// Zaren Veto — Actor root
//
// State persistence: this canister uses Enhanced Orthogonal Persistence (EOP).
// All heap objects survive upgrades automatically — no stable var / preupgrade
// / postupgrade needed.  The actor body only runs on INITIAL install; on
// upgrade the existing heap is kept as-is.
//
// Owner auto-seed: on first install the owner account is created inside the
// actor body initialisation.  A public `ensureOwnerAccount()` update function
// is also exposed so the frontend can call it after a reinstall to restore the
// owner account without losing any other data.
// ─────────────────────────────────────────────────────────────────────────────

actor {
  // ─── Users / Posts / Messages state ──────────────────────────────────────
  let users         : Map.Map<Common.UserId, Types.User>                   = Map.empty();
  let posts         : List.List<Types.Post>                                = List.empty();
  let messages      : List.List<Types.Message>                             = List.empty();
  let follows       : Map.Map<Common.UserId, Set.Set<Common.UserId>>       = Map.empty();
  let verified      : Set.Set<Common.UserId>                               = Set.empty();
  let nextPostId    : { var value : Nat }                                  = { var value = 0 };
  let nextMessageId : { var value : Nat }                                  = { var value = 0 };

  // ─── Hashtag index (shared with UPMApi and NewApi) ────────────────────────
  let hashtagIndex    : Map.Map<Text, List.List<Common.PostId>>            = Map.empty();
  let hashtagPostTime : Map.Map<Text, List.List<Common.Timestamp>>         = Map.empty();

  // ─── Official page posts ──────────────────────────────────────────────────
  let officialPagePosts : List.List<Types.Post>                            = List.empty();

  // ─── Followers reverse index (who follows userId) — avoids O(n) full scan ──
  let followers     : Map.Map<Common.UserId, List.List<Common.UserId>>     = Map.empty();

  // ─── Engagement state ─────────────────────────────────────────────────────
  let likes         : Map.Map<Common.PostId, Set.Set<Common.UserId>>                              = Map.empty();
  let reactions     : Map.Map<Common.PostId, Map.Map<Common.UserId, EngTypes.ReactionType>>       = Map.empty();
  let comments      : List.List<EngTypes.Comment>                                                 = List.empty();
  let shares        : List.List<EngTypes.Share>                                                   = List.empty();
  let notifications : List.List<EngTypes.Notification>                                            = List.empty();
  let savedPosts    : Map.Map<Common.UserId, Set.Set<Common.PostId>>                              = Map.empty();
  let reports       : List.List<EngTypes.Report>                                                  = List.empty();
  let nextCommentId : { var value : Nat }                                                         = { var value = 0 };
  let nextNotifId   : { var value : Nat }                                                         = { var value = 0 };
  let nextReportId  : { var value : Nat }                                                         = { var value = 0 };

  // ─── Post-comments index (postId → [commentId]) — avoids O(n) full scan ──
  let postCommentsIndex : Map.Map<Common.PostId, List.List<EngTypes.CommentId>>                   = Map.empty();

  // ─── Stories state ────────────────────────────────────────────────────────
  let stories       : List.List<NewTypes.Story>                            = List.empty();
  let nextStoryId   : { var value : Nat }                                  = { var value = 0 };

  // ─── Friend requests / block state ────────────────────────────────────────
  let friendRequests  : List.List<NewTypes.FriendRequest>                  = List.empty();
  let nextFriendReqId : { var value : Nat }                                = { var value = 0 };
  let blockedUsers    : Map.Map<Common.UserId, Set.Set<Common.UserId>>     = Map.empty();

  // ─── Pinned posts ─────────────────────────────────────────────────────────
  let pinnedPosts   : Map.Map<Common.UserId, Common.PostId>                = Map.empty();

  // ─── Polls state ──────────────────────────────────────────────────────────
  let polls         : List.List<NewTypes.Poll>                             = List.empty();
  let pollVotes     : List.List<NewTypes.PollVote>                         = List.empty();
  let nextPollId    : { var value : Nat }                                  = { var value = 0 };

  // ─── Message reactions ────────────────────────────────────────────────────
  let msgReactions  : List.List<EngTypes.MessageReaction>                  = List.empty();

  // ─── Groups state ────────────────────────────────────────────────────────
  let groups        : Map.Map<GroupTypes.GroupId, GroupTypes.Group>        = Map.empty();
  let nextGroupId   : { var value : Nat }                                  = { var value = 0 };
  let groupPosts      : Map.Map<GroupTypes.GroupId, List.List<GroupTypes.GroupPost>>         = Map.empty();
  let nextGroupPostId : { var value : Nat }                                                  = { var value = 0 };
  let groupPostLikes  : Map.Map<GroupTypes.GroupPostId, List.List<Common.UserId>>            = Map.empty();

  // ─── Pages state ─────────────────────────────────────────────────────────
  let pages          : Map.Map<PageTypes.PageId, PageTypes.Page>                    = Map.empty();
  let pageFollowers  : Map.Map<PageTypes.PageId, Set.Set<Common.UserId>>            = Map.empty();
  let pagePosts      : Map.Map<PageTypes.PageId, List.List<Types.Post>>             = Map.empty();
  let nextPageId     : { var value : Nat }                                          = { var value = 0 };
  let nextPagePostId : { var value : Nat }                                          = { var value = 0 };

  // ─── Username index (principal → userId for O(1) login lookup) ─────────────
  let usernameIndex : Map.Map<Text, Common.UserId>                         = Map.empty();

  // ─── Mixin composition ────────────────────────────────────────────────────
  include UPMApi(users, posts, messages, follows, followers, verified, nextPostId, nextMessageId,
                 hashtagIndex, hashtagPostTime, officialPagePosts,
                 notifications, nextNotifId, usernameIndex);

  include EngApi(users, posts, likes, reactions, comments, shares, notifications,
                 savedPosts, reports, verified, nextCommentId, nextNotifId, nextReportId,
                 postCommentsIndex);

  include NewApi(
    users, posts, messages, follows, verified, reports, notifications, nextNotifId, nextReportId,
    stories, nextStoryId,
    hashtagIndex, hashtagPostTime,
    friendRequests, nextFriendReqId, blockedUsers,
    pinnedPosts,
    polls, pollVotes, nextPollId,
    msgReactions,
    usernameIndex,
  );

  include GroupsApi(groups, nextGroupId, users, groupPosts, nextGroupPostId, groupPostLikes);

  include PagesApi(pages, pageFollowers, pagePosts, nextPageId, nextPagePostId, users);

  // ─── Owner account restoration ────────────────────────────────────────────
  // Idempotent: if owner account already exists (by username index), does nothing.
  // Safe to call any number of times from the frontend after a reinstall.
  // The owner account is identified by the normalised username key
  // "princessnarzinebanihashem" in usernameIndex.
  public shared ({ caller }) func ensureOwnerAccount(
    password : Text,
    email    : ?Text,
  ) : async { #ok : Types.UserProfile; #err : Text } {
    let ownerNorm = "princessnarzinebanihashem";
    let ownerUsername = "Princess Narzine Bani Hashem";
    // Already exists — return existing profile
    switch (usernameIndex.get(ownerNorm)) {
      case (?existingId) {
        switch (users.get(existingId)) {
          case (?user) {
            // If a password is provided and none is stored yet, set it now
            if (password.size() > 0) {
              switch (user.passwordHash) {
                case null {
                  if (UPMLib.validatePassword(password)) {
                    user.passwordHash := ?(UPMLib.hashPassword(password));
                  };
                };
                case (?_) {}; // password already set — don't overwrite
              };
            };
            let profile : Types.UserProfile = {
              id             = user.id;
              username       = user.username;
              bio            = "";
              visibility     = user.visibility;
              postCount      = 0;
              followerCount  = 19000;
              followingCount = 0;
              profilePhotoUrl = user.profilePhotoUrl;
              coverPhotoUrl   = user.coverPhotoUrl;
              isVerified      = true;
              isOfficialPage  = false;
              aboutBio        = null;
              aboutLocation   = user.aboutLocation;
              aboutWork       = user.aboutWork;
              aboutEducation  = user.aboutEducation;
              aboutWebsite    = user.aboutWebsite;
              birthdate       = user.birthdate;
            };
            return #ok(profile);
          };
          case null {}; // fall through to create
        };
      };
      case null {};
    };
    // Owner does not exist yet — create with caller's principal
    if (caller.isAnonymous()) {
      return #err("Cannot create owner account with anonymous principal — log in with Internet Identity first");
    };
    // Validate password
    if (password.size() > 0 and not UPMLib.validatePassword(password)) {
      return #err("Password must be at least 8 characters with uppercase, lowercase, and a digit");
    };
    // Build owner user record
    let ownerUser : Types.User = {
      id = caller;
      var username       = ownerUsername;
      var bio            = ""; // ALWAYS empty — frontend hardcodes the two blue lines
      var visibility     = #everyone;
      var profilePhotoUrl = null;
      var coverPhotoUrl   = null;
      var officialPageProfilePhotoUrl = null;
      var officialPageCoverPhotoUrl   = null;
      var isVerified     = true;
      var isSuspended    = false;
      var suspendedUntil = null;
      var isBanned       = false;
      var passwordHash   = if (password.size() > 0) ?(UPMLib.hashPassword(password)) else null;
      var email;
      var aboutBio       = null;
      var aboutLocation  = null;
      var aboutWork      = null;
      var aboutEducation = null;
      var aboutWebsite   = null;
      var birthdate      = null;
    };
    users.add(caller, ownerUser);
    usernameIndex.add(ownerNorm, caller);
    verified.add(caller);
    let profile : Types.UserProfile = {
      id             = caller;
      username       = ownerUsername;
      bio            = "";
      visibility     = #everyone;
      postCount      = 0;
      followerCount  = 19000;
      followingCount = 0;
      profilePhotoUrl = null;
      coverPhotoUrl   = null;
      isVerified      = true;
      isOfficialPage  = false;
      aboutBio        = null;
      aboutLocation   = null;
      aboutWork       = null;
      aboutEducation  = null;
      aboutWebsite    = null;
      birthdate       = null;
    };
    #ok(profile);
  };

  // ─── Health check (frontend polling) ──────────────────────────────────────
  // Returns true immediately.  The frontend calls this to verify the canister
  // is alive before attempting heavier calls.  Bounded O(1) — never traps.
  public query func ping() : async Bool { true };

  // ─── Owner exists check ───────────────────────────────────────────────────
  // Returns true if the owner account exists in the users map.
  public query func ownerAccountExists() : async Bool {
    switch (usernameIndex.get("princessnarzinebanihashem")) {
      case null false;
      case (?uid) users.containsKey(uid);
    };
  };
};
