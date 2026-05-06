import Common "../types/common";
import Types "../types/groups";
import Principal "mo:core/Principal";
import List "mo:core/List";

module {
  /// Convert a Group to its shared GroupView projection.
  public func groupToView(group : Types.Group, callerId : Principal) : Types.GroupView {
    let isMember = switch (group.members.find(func(m : Types.GroupMember) : Bool {
      Principal.equal(m.userId, callerId)
    })) {
      case (?_) true;
      case null false;
    };
    {
      id            = group.id;
      name          = group.name;
      description   = group.description;
      hasCoverImage = group.coverImageData != null or group.coverImageUrl != null;
      coverImageData = group.coverImageData;
      coverImageUrl  = group.coverImageUrl;
      isPrivate     = group.isPrivate;
      ownerId       = group.ownerId;
      ownerUsername = group.ownerUsername;
      memberCount   = group.members.size();
      isMember;
      createdAt     = group.createdAt;
    };
  };
};
