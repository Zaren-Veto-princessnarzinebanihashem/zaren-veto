import Common "common";
import List "mo:core/List";

module {
  public type GroupId = Nat;

  public type GroupMember = {
    userId   : Common.UserId;
    username : Text;
    joinedAt : Common.Timestamp;
  };

  public type Group = {
    id           : GroupId;
    var name     : Text;
    var description : Text;
    var coverImageData : ?Text; // base64 encoded cover image (legacy)
    var coverImageUrl  : ?Text; // object-storage URL (preferred)
    var isPrivate : Bool;
    ownerId      : Common.UserId;
    ownerUsername : Text;
    members      : List.List<GroupMember>; // growable member list
    createdAt    : Common.Timestamp;
  };

  public type GroupView = {
    id           : GroupId;
    name         : Text;
    description  : Text;
    hasCoverImage : Bool;
    coverImageData : ?Text;
    coverImageUrl  : ?Text;
    isPrivate    : Bool;
    ownerId      : Common.UserId;
    ownerUsername : Text;
    memberCount  : Nat;
    isMember     : Bool;
    createdAt    : Common.Timestamp;
  };

  // ─── Group Post ──────────────────────────────────────────────────────────
  public type GroupPostId = Nat;

  public type GroupPost = {
    id        : GroupPostId;
    groupId   : GroupId;
    authorId  : Common.UserId;
    var content  : Text;
    var imageUrl : ?Text;
    createdAt : Common.Timestamp;
    var updatedAt : Common.Timestamp;
  };

  // Shared projection of GroupPost
  public type GroupPostView = {
    id             : GroupPostId;
    groupId        : GroupId;
    authorId       : Common.UserId;
    authorName     : Text;
    authorProfilePhoto : ?Text;
    authorVerified : Bool;
    content        : Text;
    imageUrl       : ?Text;
    createdAt      : Common.Timestamp;
    updatedAt      : Common.Timestamp;
    likesCount     : Nat;
    commentsCount  : Nat;
  };

  public type CreateGroupResult  = { #ok : GroupView; #err : Text };
  public type JoinLeaveGroupResult = { #ok : Bool; #err : Text };
};
