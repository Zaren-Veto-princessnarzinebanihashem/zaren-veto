import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuthenticatedBackend } from "@/hooks/useAuthenticatedBackend";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useImageUpload } from "@/hooks/useImageUpload";
import type { GroupPostView, GroupView } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Globe,
  Heart,
  ImageIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COVER_COLORS = [
  "from-violet-600 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
];

function getCoverColor(id: bigint): string {
  return COVER_COLORS[Number(id % 5n) % COVER_COLORS.length];
}

function formatCount(n: bigint): string {
  const num = Number(n);
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(".0", "")}k`;
  return String(num);
}

function timeAgo(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function coverSrc(group: GroupView): string | null {
  if (group.coverImageUrl) return group.coverImageUrl;
  if (group.coverImageData) return group.coverImageData;
  return null;
}

// ─── Create Group Modal ───────────────────────────────────────────────────────

function CreateGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (group: GroupView) => void;
}) {
  const { actor } = useAuthenticatedBackend();
  const { uploadImage, uploading: imgUploading } = useImageUpload();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverData, setCoverData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await uploadImage(file);
      setCoverData(dataUrl);
      setCoverPreview(dataUrl);
    } catch {
      toast.error("Impossible de charger l'image.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom du groupe est requis.");
      return;
    }
    if (!actor) {
      toast.error("Non connecté");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await actor.createGroup(
        name.trim(),
        description.trim(),
        isPrivate,
        coverData,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      setDone(true);
      toast.success(`Groupe "${name.trim()}" créé !`);
      onCreated(result.ok);
      setTimeout(onClose, 600);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-ocid="groups.create_dialog"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ duration: 0.25 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Cover preview strip */}
        <div className="relative">
          <div
            className={`h-28 w-full bg-gradient-to-r ${getCoverColor(0n)} relative overflow-hidden`}
            style={
              coverPreview
                ? {
                    backgroundImage: `url(${coverPreview})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}
            }
          >
            {!coverPreview && (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <Users className="w-12 h-12 text-white" />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              disabled={imgUploading}
              title="Changer la photo de couverture"
            >
              {imgUploading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleCoverPick(e)}
          />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Créer un groupe
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth"
            aria-label="Fermer"
            data-ocid="groups.create_dialog.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="grp-name"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Nom du groupe <span className="text-destructive">*</span>
            </Label>
            <Input
              id="grp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Amateurs de photographie"
              maxLength={60}
              className="bg-secondary border-input"
              data-ocid="groups.create_name_input"
              disabled={submitting || done}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="grp-desc"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Description
            </Label>
            <Textarea
              id="grp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="À quoi sert ce groupe ?"
              rows={3}
              className="bg-secondary border-input resize-none text-sm"
              data-ocid="groups.create_description_input"
              disabled={submitting || done}
            />
          </div>

          {/* Privacy toggle */}
          <button
            type="button"
            onClick={() => setIsPrivate((v) => !v)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-smooth ${
              isPrivate
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-primary/30 bg-primary/10"
            }`}
            data-ocid="groups.create_privacy_toggle"
            disabled={submitting || done}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPrivate ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"}`}
            >
              {isPrivate ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">
                {isPrivate ? "Groupe privé" : "Groupe public"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPrivate
                  ? "Seuls les membres invités peuvent voir le contenu."
                  : "Tout le monde peut trouver et rejoindre ce groupe."}
              </p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-smooth ${isPrivate ? "border-amber-500 bg-amber-500" : "border-border bg-transparent"}`}
            >
              {isPrivate && <Check className="w-3 h-3 text-white" />}
            </div>
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={!name.trim() || submitting || done}
              className="flex-1 gap-2"
              data-ocid="groups.create_submit_button"
            >
              {done ? (
                <>
                  <Check className="w-4 h-4" />
                  Créé !
                </>
              ) : submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Création…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer le groupe
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting || done}
              data-ocid="groups.create_cancel_button"
            >
              Annuler
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Group Post Card ──────────────────────────────────────────────────────────

function GroupPostCard({
  post,
  currentUsername,
  isGroupOwner,
  onDelete,
  onEdit,
  onLikeToggle,
  likedByMe,
}: {
  post: GroupPostView;
  groupId: bigint;
  currentUsername: string;
  isGroupOwner: boolean;
  onDelete: (postId: bigint) => void;
  onEdit: (postId: bigint, newContent: string) => void;
  onLikeToggle: (postId: bigint, liked: boolean) => void;
  likedByMe: boolean;
}) {
  const isAuthor = post.authorName === currentUsername;
  const canDelete = isAuthor || isGroupOwner;
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const submitEdit = () => {
    if (editContent.trim() && editContent.trim() !== post.content) {
      onEdit(post.id, editContent.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-ocid={`group.post.${post.id}`}
    >
      {/* Post header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
          {post.authorProfilePhoto ? (
            <img
              src={post.authorProfilePhoto}
              alt={post.authorName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-primary">
              {post.authorName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {post.authorName}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {(isAuthor || canDelete) && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Options"
              data-ocid={`group.post.options_button.${post.id}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-9 z-30 w-40 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                >
                  {isAuthor && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                      onClick={() => {
                        setEditing(true);
                        setEditContent(post.content);
                        setShowMenu(false);
                      }}
                      data-ocid={`group.post.edit_button.${post.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => {
                        onDelete(post.id);
                        setShowMenu(false);
                      }}
                      data-ocid={`group.post.delete_button.${post.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Post content */}
      <div className="px-4 pb-3">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="bg-secondary border-input resize-none text-sm min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={submitEdit}
                className="gap-1"
                data-ocid={`group.post.save_edit.${post.id}`}
              >
                <Check className="w-3.5 h-3.5" />
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                data-ocid={`group.post.cancel_edit.${post.id}`}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
        )}
      </div>

      {/* Post image */}
      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full rounded-lg object-cover max-h-80"
          />
        </div>
      )}

      {/* Divider + actions */}
      <div className="border-t border-border px-4 py-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onLikeToggle(post.id, likedByMe)}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            likedByMe
              ? "text-red-500"
              : "text-muted-foreground hover:text-red-400"
          }`}
          data-ocid={`group.post.like_button.${post.id}`}
        >
          <Heart className={`w-4 h-4 ${likedByMe ? "fill-red-500" : ""}`} />
          <span>{formatCount(post.likesCount)}</span>
        </button>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <svg
            role="img"
            aria-label="Commentaires"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <title>Commentaires</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>{formatCount(post.commentsCount)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Group Detail View ────────────────────────────────────────────────────────

function GroupDetailView({
  groupId,
  onBack,
}: {
  groupId: bigint;
  onBack: () => void;
}) {
  const { actor } = useAuthenticatedBackend();
  const { profile } = useCurrentUser();
  const { uploadImage, uploading: imgUploading } = useImageUpload();
  const coverFileRef = useRef<HTMLInputElement>(null);
  const postImgRef = useRef<HTMLInputElement>(null);

  const [group, setGroup] = useState<GroupView | null>(null);
  const [posts, setPosts] = useState<GroupPostView[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [postImageData, setPostImageData] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [joiningLeaving, setJoiningLeaving] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [updatingCover, setUpdatingCover] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const isOwner =
    group && profile && group.ownerId.toText() === profile.id.toText();

  const loadGroup = useCallback(async () => {
    if (!actor) return;
    setLoadingGroup(true);
    try {
      const g = await actor.getGroup(groupId);
      setGroup(g ?? null);
    } catch {
      toast.error("Impossible de charger le groupe.");
    } finally {
      setLoadingGroup(false);
    }
  }, [actor, groupId]);

  const loadPosts = useCallback(async () => {
    if (!actor) return;
    setLoadingPosts(true);
    try {
      const result = await actor.getGroupPosts(groupId);
      setPosts([...result].reverse());
    } catch {
      /* silent */
    } finally {
      setLoadingPosts(false);
    }
  }, [actor, groupId]);

  useEffect(() => {
    if (actor) {
      void loadGroup();
      void loadPosts();
    }
  }, [actor, loadGroup, loadPosts]);

  const handleJoin = async () => {
    if (!actor || !group) return;
    setJoiningLeaving(true);
    try {
      const result = await actor.joinGroup(groupId);
      if (result.__kind__ === "err") throw new Error(result.err);
      setGroup((prev) =>
        prev
          ? { ...prev, isMember: true, memberCount: prev.memberCount + 1n }
          : prev,
      );
      toast.success("Vous avez rejoint le groupe !");
    } catch {
      toast.error("Impossible de rejoindre le groupe.");
    } finally {
      setJoiningLeaving(false);
    }
  };

  const handleLeave = async () => {
    if (!actor || !group) return;
    setJoiningLeaving(true);
    try {
      const result = await actor.leaveGroup(groupId);
      if (result.__kind__ === "err") throw new Error(result.err);
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              isMember: false,
              memberCount: prev.memberCount > 0n ? prev.memberCount - 1n : 0n,
            }
          : prev,
      );
      toast.success("Vous avez quitté le groupe.");
    } catch {
      toast.error("Impossible de quitter le groupe.");
    } finally {
      setJoiningLeaving(false);
    }
  };

  const handlePostImagePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await uploadImage(file);
      setPostImageData(dataUrl);
      setPostImagePreview(dataUrl);
    } catch {
      toast.error("Impossible de charger l'image.");
    }
  };

  const handlePublish = async () => {
    if (!actor || !postContent.trim()) return;
    setPublishing(true);
    try {
      const result = await actor.createGroupPost(
        groupId,
        postContent.trim(),
        postImageData,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      const newPostId = result.ok;
      // Build optimistic post entry
      const optimisticPost: GroupPostView = {
        id: newPostId,
        groupId,
        content: postContent.trim(),
        authorId: profile!.id,
        authorName: profile!.username,
        authorProfilePhoto: profile?.profilePhotoUrl,
        authorVerified: profile?.isVerified ?? false,
        createdAt: BigInt(Date.now()) * 1_000_000n,
        updatedAt: BigInt(Date.now()) * 1_000_000n,
        imageUrl: postImageData ?? undefined,
        likesCount: 0n,
        commentsCount: 0n,
      };
      setPosts((prev) => [optimisticPost, ...prev]);
      setPostContent("");
      setPostImageData(null);
      setPostImagePreview(null);
      toast.success("Publication réussie !");
    } catch {
      toast.error("Impossible de publier.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeletePost = async (postId: bigint) => {
    if (!actor) return;
    try {
      const result = await actor.deleteGroupPost(groupId, postId);
      if (result.__kind__ === "err") throw new Error(result.err);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Publication supprimée.");
    } catch {
      toast.error("Impossible de supprimer la publication.");
    }
  };

  const handleEditPost = async (postId: bigint, newContent: string) => {
    if (!actor) return;
    try {
      const result = await actor.editGroupPost(groupId, postId, newContent);
      if (result.__kind__ === "err") throw new Error(result.err);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, content: newContent } : p)),
      );
      toast.success("Publication modifiée.");
    } catch {
      toast.error("Impossible de modifier la publication.");
    }
  };

  const handleLikeToggle = async (postId: bigint, liked: boolean) => {
    if (!actor) return;
    const key = postId.toString();
    // Optimistic update
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(key);
      else next.add(key);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likesCount: liked
                ? p.likesCount > 0n
                  ? p.likesCount - 1n
                  : 0n
                : p.likesCount + 1n,
            }
          : p,
      ),
    );
    try {
      if (liked) {
        await actor.unlikeGroupPost(groupId, postId);
      } else {
        await actor.likeGroupPost(groupId, postId);
      }
    } catch {
      // Revert optimistic update
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (liked) next.add(key);
        else next.delete(key);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likesCount: liked
                  ? p.likesCount + 1n
                  : p.likesCount > 0n
                    ? p.likesCount - 1n
                    : 0n,
              }
            : p,
        ),
      );
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actor) return;
    setUpdatingCover(true);
    try {
      const dataUrl = await uploadImage(file);
      const result = await actor.updateGroupCoverImage(groupId, dataUrl);
      if (result.__kind__ === "err") throw new Error(result.err);
      setGroup((prev) => (prev ? { ...prev, coverImageUrl: dataUrl } : prev));
      toast.success("Photo de couverture mise à jour !");
    } catch {
      toast.error("Impossible de mettre à jour la couverture.");
    } finally {
      setUpdatingCover(false);
    }
  };

  const handleInvite = async () => {
    if (!actor || !inviteUsername.trim()) return;
    setInviting(true);
    try {
      const result = await actor.inviteMember(groupId, inviteUsername.trim());
      if (result.__kind__ === "err") throw new Error(result.err);
      toast.success(`Invitation envoyée à ${inviteUsername.trim()} !`);
      setInviteUsername("");
      setShowInvite(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d'inviter ce membre.",
      );
    } finally {
      setInviting(false);
    }
  };

  if (loadingGroup) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground"
          data-ocid="group.back_button"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux groupes
        </Button>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-16" data-ocid="group.not_found">
        <p className="text-muted-foreground">Groupe introuvable.</p>
        <Button variant="ghost" onClick={onBack} className="mt-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
      </div>
    );
  }

  const src = coverSrc(group);
  const memberCount = Number(group.memberCount);

  return (
    <div className="space-y-4" data-ocid="group.detail">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-ocid="group.back_button"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux groupes
      </button>

      {/* Cover image */}
      <div className="relative rounded-xl overflow-hidden">
        <div
          className={`h-52 w-full bg-gradient-to-r ${getCoverColor(group.id)} relative`}
          style={
            src
              ? {
                  backgroundImage: `url(${src})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}
          }
        >
          {!src && (
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <Users className="w-20 h-20 text-white" />
            </div>
          )}
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => coverFileRef.current?.click()}
                disabled={updatingCover || imgUploading}
                className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors"
                data-ocid="group.change_cover_button"
              >
                {updatingCover ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                Modifier la couverture
              </button>
              <input
                ref={coverFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleCoverChange(e)}
              />
            </>
          )}
        </div>
      </div>

      {/* Group info card */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-foreground leading-tight">
              {group.name}
            </h1>
            {group.description && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {group.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {memberCount} membre{memberCount !== 1 ? "s" : ""}
              </span>
              <span
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                  group.isPrivate
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-primary/30 bg-primary/10 text-primary"
                }`}
              >
                {group.isPrivate ? (
                  <Lock className="w-2.5 h-2.5" />
                ) : (
                  <Globe className="w-2.5 h-2.5" />
                )}
                {group.isPrivate ? "Groupe privé" : "Groupe public"}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInvite((v) => !v)}
                className="gap-2"
                data-ocid="group.invite_button"
              >
                <Plus className="w-3.5 h-3.5" />
                Inviter
              </Button>
            )}
            {!isOwner &&
              (group.isMember ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLeave()}
                  disabled={joiningLeaving}
                  className="gap-2"
                  data-ocid="group.leave_button"
                >
                  {joiningLeaving ? (
                    <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Membre
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void handleJoin()}
                  disabled={joiningLeaving}
                  className="gap-2"
                  data-ocid="group.join_button"
                >
                  {joiningLeaving ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  Rejoindre le groupe
                </Button>
              ))}
          </div>
        </div>

        {/* Invite panel */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border flex gap-2">
                <Input
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="Nom d'utilisateur à inviter"
                  className="bg-secondary border-input text-sm"
                  onKeyDown={(e) => e.key === "Enter" && void handleInvite()}
                  data-ocid="group.invite_input"
                />
                <Button
                  size="sm"
                  disabled={!inviteUsername.trim() || inviting}
                  onClick={() => void handleInvite()}
                  className="shrink-0 gap-2"
                  data-ocid="group.invite_submit_button"
                >
                  {inviting ? (
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Inviter
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Post creation box (members only) */}
      {(group.isMember || isOwner) && (
        <div
          className="bg-card border border-border rounded-xl p-4 space-y-3"
          data-ocid="group.post_composer"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {profile?.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-primary">
                  {(profile?.username ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <Textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Écrire dans ce groupe…"
              rows={2}
              className="bg-secondary border-input resize-none text-sm flex-1"
              data-ocid="group.post_input"
            />
          </div>

          {postImagePreview && (
            <div className="relative inline-block">
              <img
                src={postImagePreview}
                alt=""
                className="h-24 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setPostImagePreview(null);
                  setPostImageData(null);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center text-white"
                aria-label="Supprimer l'image"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => postImgRef.current?.click()}
              disabled={imgUploading}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
              data-ocid="group.post_image_button"
            >
              <ImageIcon className="w-4 h-4" />
              {imgUploading ? "Chargement…" : "Photo"}
            </button>
            <input
              ref={postImgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePostImagePick(e)}
            />
            <Button
              size="sm"
              disabled={!postContent.trim() || publishing}
              onClick={() => void handlePublish()}
              className="gap-2"
              data-ocid="group.post_submit_button"
            >
              {publishing ? (
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Publier
            </Button>
          </div>
        </div>
      )}

      {/* Posts feed */}
      <div className="space-y-3" data-ocid="group.posts_list">
        {loadingPosts ? (
          ["p1", "p2"].map((k) => (
            <Skeleton key={k} className="h-32 w-full rounded-xl" />
          ))
        ) : posts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 bg-card border border-border rounded-xl"
            data-ocid="group.posts_empty_state"
          >
            <Users className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              {group.isMember || isOwner
                ? "Soyez le premier à publier dans ce groupe !"
                : "Rejoignez le groupe pour voir et publier du contenu."}
            </p>
          </div>
        ) : (
          posts.map((post, i) => (
            <GroupPostCard
              key={post.id.toString()}
              post={post}
              groupId={groupId}
              currentUsername={profile?.username ?? ""}
              isGroupOwner={!!isOwner}
              onDelete={(id) => void handleDeletePost(id)}
              onEdit={(id, content) => void handleEditPost(id, content)}
              onLikeToggle={(id, liked) => void handleLikeToggle(id, liked)}
              likedByMe={likedPosts.has(post.id.toString())}
              data-ocid={`group.post.${i + 1}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Group Card (list view) ───────────────────────────────────────────────────

function GroupCard({
  group,
  index,
  onJoin,
  onLeave,
  joining,
  onClick,
}: {
  group: GroupView;
  index: number;
  onJoin: (id: bigint) => void;
  onLeave: (id: bigint) => void;
  joining: boolean;
  onClick: () => void;
}) {
  const src = coverSrc(group);
  const memberCount = Number(group.memberCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-smooth cursor-pointer"
      onClick={onClick}
      data-ocid={`groups.item.${index + 1}`}
    >
      {/* Cover strip */}
      <div
        className={`h-28 bg-gradient-to-r ${getCoverColor(group.id)} relative`}
        style={
          src
            ? {
                backgroundImage: `url(${src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}
        }
      >
        {!src && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <Users className="w-12 h-12 text-white" />
          </div>
        )}
        <span
          className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm ${
            group.isPrivate
              ? "border-amber-500/40 bg-amber-900/70 text-amber-300"
              : "border-primary/30 bg-primary/20 text-primary-foreground"
          }`}
        >
          {group.isPrivate ? (
            <Lock className="w-2.5 h-2.5" />
          ) : (
            <Globe className="w-2.5 h-2.5" />
          )}
          {group.isPrivate ? "Privé" : "Public"}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
          {group.name}
        </h3>
        {group.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {group.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          {memberCount} membre{memberCount !== 1 ? "s" : ""}
        </div>
        <Button
          size="sm"
          variant={group.isMember ? "outline" : "default"}
          className="w-full mt-1"
          data-ocid={`groups.join_button.${index + 1}`}
          disabled={joining}
          onClick={(e) => {
            e.stopPropagation();
            if (group.isMember) {
              onLeave(group.id);
            } else {
              onJoin(group.id);
            }
          }}
        >
          {joining ? (
            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : group.isMember ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1" />
              Membre
            </>
          ) : (
            "Rejoindre le groupe"
          )}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { status } = useCurrentUser();
  const navigate = useNavigate();
  const { actor, isFetching } = useAuthenticatedBackend();
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [joiningId, setJoiningId] = useState<bigint | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<bigint | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") void navigate({ to: "/login" });
  }, [status, navigate]);

  const loadGroups = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoading(true);
    setLoadError("");
    try {
      const result = await actor.getGroups();
      setGroups(result ?? []);
    } catch {
      setLoadError("Impossible de charger les groupes.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [actor, isFetching]);

  useEffect(() => {
    if (actor && !isFetching) void loadGroups();
  }, [actor, isFetching, loadGroups]);

  const handleJoin = async (groupId: bigint) => {
    if (!actor) return;
    setJoiningId(groupId);
    try {
      const result = await actor.joinGroup(groupId);
      if (result.__kind__ === "err") throw new Error(result.err);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, isMember: true, memberCount: g.memberCount + 1n }
            : g,
        ),
      );
      toast.success("Vous avez rejoint le groupe !");
    } catch {
      toast.error("Impossible de rejoindre le groupe.");
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (groupId: bigint) => {
    if (!actor) return;
    setJoiningId(groupId);
    try {
      const result = await actor.leaveGroup(groupId);
      if (result.__kind__ === "err") throw new Error(result.err);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                isMember: false,
                memberCount: g.memberCount > 0n ? g.memberCount - 1n : 0n,
              }
            : g,
        ),
      );
      toast.success("Vous avez quitté le groupe.");
    } catch {
      toast.error("Impossible de quitter le groupe.");
    } finally {
      setJoiningId(null);
    }
  };

  if (status === "initializing") {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-6 space-y-4">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  if (status === "unauthenticated") return null;

  // ── Group detail view ──────────────────────────────────────────────────────
  if (selectedGroupId !== null) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-4 sm:py-6">
          <GroupDetailView
            groupId={selectedGroupId}
            onBack={() => {
              setSelectedGroupId(null);
              // Refresh list in background so member status is up to date
              setTimeout(() => void loadGroups(), 300);
            }}
          />
        </div>
      </Layout>
    );
  }

  // ── Groups list view ───────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        className="max-w-4xl mx-auto py-4 sm:py-6 space-y-5"
        data-ocid="groups.page"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Groupes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Rejoignez des communautés ou créez la vôtre.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadGroups()}
              disabled={loading}
              className="gap-2 text-muted-foreground hover:text-foreground"
              aria-label="Actualiser"
              data-ocid="groups.refresh_button"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              onClick={() => setShowCreate(true)}
              className="gap-2 shrink-0"
              data-ocid="groups.create_button"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Créer un groupe</span>
              <span className="sm:hidden">Créer</span>
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {loadError && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive"
            data-ocid="groups.error_state"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        )}

        {/* Groups grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {["l1", "l2", "l3", "l4", "l5", "l6"].map((k) => (
              <Skeleton key={k} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl"
            data-ocid="groups.empty_state"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">
              Aucun groupe pour l&apos;instant
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Créez votre premier groupe et invitez vos amis à rejoindre la
              communauté.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="gap-2"
              data-ocid="groups.empty_create_button"
            >
              <Plus className="w-4 h-4" />
              Créer un groupe
            </Button>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            data-ocid="groups.list"
          >
            {groups.map((g, i) => (
              <GroupCard
                key={g.id.toString()}
                group={g}
                index={i}
                onJoin={(id) => void handleJoin(id)}
                onLeave={(id) => void handleLeave(id)}
                joining={joiningId === g.id}
                onClick={() => setSelectedGroupId(g.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateGroupModal
            onClose={() => setShowCreate(false)}
            onCreated={(newGroup) => {
              setGroups((prev) => [newGroup, ...prev]);
              setShowCreate(false);
            }}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
