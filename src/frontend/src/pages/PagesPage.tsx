import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuthenticatedBackend } from "@/hooks/useAuthenticatedBackend";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Heart,
  ImageIcon,
  LayoutGrid,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PageView, PostView } from "../backend.d.ts";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_CATEGORIES = [
  { value: "business", label: "Entreprise" },
  { value: "artist", label: "Artiste" },
  { value: "community", label: "Communauté" },
  { value: "entertainment", label: "Divertissement" },
  { value: "organization", label: "Organisation" },
  { value: "other", label: "Autre" },
];

const COVER_GRADIENTS = [
  "linear-gradient(135deg,#0f1c5e 0%,#4169E1 60%,#5c7df5 100%)",
  "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)",
  "linear-gradient(135deg,#2d1b69 0%,#4169E1 100%)",
  "linear-gradient(135deg,#0d1b2a 0%,#1b4332 50%,#40916c 100%)",
  "linear-gradient(135deg,#1c0533 0%,#7b2d8b 60%,#e040fb 100%)",
];

function getCoverGradient(id: bigint): string {
  const idx = Number(id % BigInt(COVER_GRADIENTS.length));
  return COVER_GRADIENTS[Math.abs(idx)];
}

function formatCount(n: bigint): string {
  const num = Number(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

function timeAgo(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const diff = Date.now() - ms;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "à l'instant";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// ─── Create Page Modal ────────────────────────────────────────────────────────

function CreatePageModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (page: PageView) => void;
}) {
  const { actor } = useAuthenticatedBackend();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom de la page est requis.");
      return;
    }
    if (!actor) {
      toast.error("Non connecté");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await actor.createPage(
        name.trim(),
        description.trim(),
        category,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      toast.success(`Page "${name.trim()}" créée avec succès !`);
      onCreated(result.ok);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erreur lors de la création";
      setError(
        msg.includes("IC0508")
          ? "Service temporairement indisponible. Réessayez."
          : msg,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-ocid="pages.create_dialog"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ duration: 0.25 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Créer une page
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Fermer"
            data-ocid="pages.create_dialog.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="p-5 space-y-4"
          data-ocid="pages.create_form"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="page-name"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Nom de la page <span className="text-destructive">*</span>
            </Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Ma boutique"
              maxLength={60}
              className="bg-secondary border-input"
              data-ocid="pages.create_name_input"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="page-desc"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Description
            </Label>
            <Textarea
              id="page-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="De quoi parle votre page ?"
              rows={3}
              maxLength={300}
              className="bg-secondary border-input resize-none text-sm"
              data-ocid="pages.create_description_input"
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="page-category"
              className="text-xs uppercase tracking-wide text-muted-foreground font-medium"
            >
              Catégorie
            </Label>
            <select
              id="page-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
              data-ocid="pages.create_category_select"
              className="w-full h-10 rounded-md border border-input bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {PAGE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={!name.trim() || submitting}
              className="flex-1 gap-2"
              data-ocid="pages.create_submit_button"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Création…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Créer la page
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              data-ocid="pages.create_cancel_button"
            >
              Annuler
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Edit Post Modal ───────────────────────────────────────────────────────────

function EditPostModal({
  post,
  onClose,
  onSaved,
}: {
  post: PostView;
  onClose: () => void;
  onSaved: (postId: bigint, content: string, imageUrl?: string) => void;
}) {
  const { actor } = useAuthenticatedBackend();
  const { uploadImage, uploading: imgUploading } = useImageUpload();
  const [content, setContent] = useState(post.content);
  const [imageUrl, setImageUrl] = useState<string | undefined>(post.imageUrl);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch {
      toast.error("Échec du chargement de l'image");
    }
  };

  const handleSave = async () => {
    if (!actor || !content.trim()) return;
    setSaving(true);
    try {
      await actor.editPostWithImage(post.id, content.trim(), imageUrl ?? null);
      onSaved(post.id, content.trim(), imageUrl);
      onClose();
    } catch {
      toast.error("Impossible de modifier le post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-ocid="pages.edit_post_dialog"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Modifier le post</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Fermer"
            data-ocid="pages.edit_post_dialog.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="bg-secondary border-input resize-none text-sm"
            placeholder="Contenu du post…"
            data-ocid="pages.edit_post_textarea"
          />
          {imageUrl && (
            <div className="relative">
              <img
                src={imageUrl}
                alt=""
                className="rounded-lg w-full max-h-40 object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(undefined)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                aria-label="Supprimer l'image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={imgUploading}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              data-ocid="pages.edit_post_image_button"
            >
              <ImageIcon className="w-4 h-4" />
              {imgUploading ? "Chargement…" : "Image"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleImagePick(e)}
            />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
              data-ocid="pages.edit_post_cancel_button"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={!content.trim() || saving || imgUploading}
              data-ocid="pages.edit_post_save_button"
            >
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Page Detail View ─────────────────────────────────────────────────────────

function PageDetailView({
  page: initialPage,
  currentUserId,
  onBack: _onBack,
}: {
  page: PageView;
  currentUserId: string | null;
  onBack: () => void;
}) {
  const { actor } = useAuthenticatedBackend();
  const { uploadImage, uploading: coverUploading } = useImageUpload();
  const { uploadImage: uploadPostImg, uploading: postImgUploading } =
    useImageUpload();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const postImgRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState<PageView>(initialPage);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [postImageUrl, setPostImageUrl] = useState<string | undefined>();
  const [publishing, setPublishing] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<bigint>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Map<bigint, number>>(new Map());
  const [editingPost, setEditingPost] = useState<PostView | null>(null);
  // Comment state: which post has its comment section open, and the text per post
  const [openCommentIds, setOpenCommentIds] = useState<Set<bigint>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Map<bigint, string>>(
    new Map(),
  );
  const [submittingCommentIds, setSubmittingCommentIds] = useState<Set<bigint>>(
    new Set(),
  );
  const [postComments, setPostComments] = useState<
    Map<bigint, Array<{ id: bigint; authorName: string; content: string }>>
  >(new Map());

  const isCreator =
    currentUserId != null && page.ownerId.toText() === currentUserId;

  // Load posts
  useEffect(() => {
    if (!actor) return;
    void (async () => {
      setPostsLoading(true);
      try {
        const result = await actor.getPagePosts(page.id);
        const sorted = [...result].sort((a, b) =>
          Number(b.createdAt - a.createdAt),
        );
        setPosts(sorted);
        // Init like counts from posts stats (getPostStats per post is expensive — seed to 0)
        const counts = new Map<bigint, number>();
        for (const p of sorted) counts.set(p.id, 0);
        setLikeCounts(counts);
      } catch {
        /* non-blocking */
      } finally {
        setPostsLoading(false);
      }
    })();
  }, [actor, page.id]);

  // Cover photo upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actor) return;
    try {
      const url = await uploadImage(file);
      const result = await actor.updatePageCoverPhoto(page.id, url);
      if (result.__kind__ === "err") throw new Error(result.err);
      setPage((prev) => ({ ...prev, coverPhotoUrl: url }));
      toast.success("Photo de couverture mise à jour !");
    } catch {
      toast.error("Impossible de mettre à jour la photo de couverture");
    }
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  // Post image pick
  const handlePostImagePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadPostImg(file);
      setPostImageUrl(url);
    } catch {
      toast.error("Échec du chargement de l'image");
    }
    if (postImgRef.current) postImgRef.current.value = "";
  };

  const handleFollow = async () => {
    if (!actor) return;
    try {
      if (page.isFollowing) {
        const r = await actor.unfollowPage(page.id);
        if (r.__kind__ === "err") throw new Error(r.err);
        setPage((prev) => ({
          ...prev,
          isFollowing: false,
          followerCount: prev.followerCount - 1n,
        }));
      } else {
        const r = await actor.followPage(page.id);
        if (r.__kind__ === "err") throw new Error(r.err);
        setPage((prev) => ({
          ...prev,
          isFollowing: true,
          followerCount: prev.followerCount + 1n,
        }));
      }
    } catch {
      toast.error("Action échouée. Réessayez.");
    }
  };

  const handlePublish = async () => {
    if (!actor || !postContent.trim()) return;
    setPublishing(true);
    try {
      const result = await actor.createPagePost(page.id, postContent.trim());
      if (result.__kind__ === "err") throw new Error(result.err);
      const newPost: PostView = {
        id: result.ok.id,
        content: postContent.trim(),
        authorId: page.ownerId,
        authorName: page.name,
        authorVerified: page.isVerified,
        createdAt: BigInt(Date.now()) * 1_000_000n,
        updatedAt: BigInt(Date.now()) * 1_000_000n,
        imageUrl: postImageUrl,
        isRepost: false,
        isPinned: false,
        visibility: result.ok.visibility,
      };
      setPosts((prev) => [newPost, ...prev]);
      setLikeCounts((prev) => new Map(prev).set(newPost.id, 0));
      setPostContent("");
      setPostImageUrl(undefined);
      toast.success("Post publié !");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(
        msg.includes("IC0508")
          ? "Service temporairement indisponible"
          : `Erreur : ${msg}`,
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (postId: bigint) => {
    if (!actor) return;
    const wasLiked = likedIds.has(postId);
    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setLikeCounts((prev) => {
      const next = new Map(prev);
      next.set(postId, (next.get(postId) ?? 0) + (wasLiked ? -1 : 1));
      return next;
    });
    try {
      if (wasLiked) await actor.unlikePost(postId);
      else await actor.likePost(postId);
    } catch {
      // Revert
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setLikeCounts((prev) => {
        const next = new Map(prev);
        next.set(postId, (next.get(postId) ?? 0) + (wasLiked ? 1 : -1));
        return next;
      });
    }
  };

  const handleDelete = async (postId: bigint) => {
    if (!actor) return;
    const confirmed = window.confirm("Supprimer ce post ?");
    if (!confirmed) return;
    try {
      await actor.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post supprimé.");
    } catch {
      toast.error("Impossible de supprimer le post");
    }
  };

  const handleEditSaved = (
    postId: bigint,
    content: string,
    imageUrl?: string,
  ) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, content, imageUrl } : p)),
    );
  };

  const toggleComments = async (postId: bigint) => {
    const isOpen = openCommentIds.has(postId);
    setOpenCommentIds((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(postId);
      else next.add(postId);
      return next;
    });
    // Load comments when opening
    if (!isOpen && actor && !postComments.has(postId)) {
      try {
        const comments = await actor.getComments(postId);
        setPostComments((prev) =>
          new Map(prev).set(
            postId,
            comments.map((c) => ({
              id: c.id,
              authorName: c.authorName,
              content: c.content,
            })),
          ),
        );
      } catch {
        /* non-blocking */
      }
    }
  };

  const handleCommentSubmit = async (postId: bigint) => {
    const text = (commentTexts.get(postId) ?? "").trim();
    if (!text || !actor || submittingCommentIds.has(postId)) return;
    setSubmittingCommentIds((prev) => new Set(prev).add(postId));
    try {
      await actor.addComment(postId, text);
      // Refresh comments
      const comments = await actor.getComments(postId);
      setPostComments((prev) =>
        new Map(prev).set(
          postId,
          comments.map((c) => ({
            id: c.id,
            authorName: c.authorName,
            content: c.content,
          })),
        ),
      );
      setCommentTexts((prev) => {
        const next = new Map(prev);
        next.delete(postId);
        return next;
      });
      toast.success("Commentaire ajouté !");
    } catch {
      toast.error("Impossible d'ajouter le commentaire");
    } finally {
      setSubmittingCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const catLabel =
    PAGE_CATEGORIES.find((c) => c.value === page.category)?.label ??
    page.category;

  return (
    <div data-ocid="pages.detail_view">
      {/* Cover photo */}
      <div
        className="relative h-48 sm:h-56 w-full overflow-hidden rounded-xl mb-0"
        style={
          !page.coverPhotoUrl ? { background: getCoverGradient(page.id) } : {}
        }
      >
        {page.coverPhotoUrl && (
          <img
            src={page.coverPhotoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        {isCreator && (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
            data-ocid="pages.detail.cover_upload_button"
            aria-label="Modifier la photo de couverture"
          >
            {coverUploading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>{coverUploading ? "Chargement…" : "Modifier"}</span>
          </button>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleCoverUpload(e)}
        />
      </div>

      {/* Page info */}
      <div className="bg-card border border-border rounded-xl p-4 mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-foreground leading-tight">
              {page.name}
            </h1>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {catLabel}
            </span>
            <p className="flex items-center gap-1 mt-1.5 text-sm text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>
                {formatCount(page.followerCount)} abonné
                {Number(page.followerCount) !== 1 ? "s" : ""}
              </span>
            </p>
            {page.description && (
              <p className="mt-2 text-sm text-foreground/80 leading-relaxed">
                {page.description}
              </p>
            )}
          </div>
          {!isCreator && (
            <Button
              size="sm"
              variant={page.isFollowing ? "outline" : "default"}
              onClick={() => void handleFollow()}
              className="shrink-0"
              data-ocid="pages.detail.follow_button"
            >
              {page.isFollowing ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Abonné
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Suivre
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Post creation (creator only) */}
      {isCreator && (
        <div
          className="bg-card border border-border rounded-xl p-4 mt-3 space-y-3"
          data-ocid="pages.detail.post_create_box"
        >
          <Textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder={`Écrire quelque chose sur ${page.name}…`}
            rows={3}
            className="bg-secondary border-input resize-none text-sm"
            data-ocid="pages.detail.post_textarea"
          />
          {postImageUrl && (
            <div className="relative">
              <img
                src={postImageUrl}
                alt=""
                className="rounded-lg max-h-40 object-cover"
              />
              <button
                type="button"
                onClick={() => setPostImageUrl(undefined)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                aria-label="Supprimer l'image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => postImgRef.current?.click()}
              disabled={postImgUploading}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              data-ocid="pages.detail.post_image_button"
            >
              <ImageIcon className="w-4 h-4" />
              <span>{postImgUploading ? "Chargement…" : "Photo"}</span>
            </button>
            <input
              ref={postImgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePostImagePick(e)}
            />
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={!postContent.trim() || publishing || postImgUploading}
              onClick={() => void handlePublish()}
              className="gap-2"
              data-ocid="pages.detail.post_publish_button"
            >
              {publishing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Publication…
                </>
              ) : (
                "Publier"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Posts list */}
      <div className="mt-3 space-y-3" data-ocid="pages.detail.posts_list">
        {postsLoading ? (
          [1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-28 w-full rounded-xl" />
          ))
        ) : posts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-xl"
            data-ocid="pages.detail.posts_empty_state"
          >
            <LayoutGrid className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {isCreator
                ? "Publiez votre premier post !"
                : "Aucun post pour l'instant."}
            </p>
          </div>
        ) : (
          posts.map((post, i) => (
            <motion.div
              key={post.id.toString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
              data-ocid={`pages.detail.post.${i + 1}`}
            >
              {/* Post header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                    {page.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {page.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(post.createdAt)}
                    </p>
                  </div>
                </div>
                {isCreator && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingPost(post)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label="Modifier"
                      data-ocid={`pages.detail.post_edit_button.${i + 1}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(post.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Supprimer"
                      data-ocid={`pages.detail.post_delete_button.${i + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Post content */}
              <div className="px-4 pb-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {post.content}
                </p>
              </div>
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt=""
                  className="w-full max-h-80 object-cover"
                />
              )}

              {/* Inline comment section */}
              {openCommentIds.has(post.id) && (
                <div
                  className="px-4 py-3 border-t border-border/60 space-y-3"
                  data-ocid={`pages.detail.comment_section.${i + 1}`}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleCommentSubmit(post.id);
                    }}
                    className="flex gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={commentTexts.get(post.id) ?? ""}
                      onChange={(e) =>
                        setCommentTexts((prev) =>
                          new Map(prev).set(post.id, e.target.value),
                        )
                      }
                      placeholder="Écrire un commentaire…"
                      className="flex-1 text-sm bg-secondary rounded-full px-4 py-2 border border-input text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                      disabled={submittingCommentIds.has(post.id)}
                      maxLength={500}
                      data-ocid={`pages.detail.comment_input.${i + 1}`}
                    />
                    <button
                      type="submit"
                      disabled={
                        !(commentTexts.get(post.id) ?? "").trim() ||
                        submittingCommentIds.has(post.id)
                      }
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40 transition-smooth hover:bg-primary/90"
                      aria-label="Envoyer"
                      data-ocid={`pages.detail.comment_submit.${i + 1}`}
                    >
                      {submittingCommentIds.has(post.id) ? (
                        <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin block" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </form>
                  {/* Existing comments */}
                  {(postComments.get(post.id) ?? []).length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {(postComments.get(post.id) ?? []).map((c) => (
                        <div
                          key={c.id.toString()}
                          className="flex gap-2 items-start"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {c.authorName.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 bg-secondary rounded-xl px-3 py-1.5">
                            <span className="text-xs font-semibold text-foreground mr-1.5">
                              {c.authorName}
                            </span>
                            <span className="text-xs text-foreground/80 break-words">
                              {c.content}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Post actions */}
              <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => void handleLike(post.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    likedIds.has(post.id)
                      ? "text-red-500 bg-red-500/10"
                      : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  }`}
                  data-ocid={`pages.detail.post_like_button.${i + 1}`}
                >
                  <Heart
                    className={`w-4 h-4 ${likedIds.has(post.id) ? "fill-red-500" : ""}`}
                  />
                  <span>{likeCounts.get(post.id) ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void toggleComments(post.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    openCommentIds.has(post.id)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                  data-ocid={`pages.detail.post_comment_button.${i + 1}`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Commenter</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      void navigator.share({
                        title: page.name,
                        text: post.content,
                        url,
                      });
                    } else {
                      void navigator.clipboard
                        .writeText(url)
                        .then(() => toast.success("Lien copié !"));
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  data-ocid={`pages.detail.post_share_button.${i + 1}`}
                >
                  <Share2 className="w-4 h-4" />
                  <span>Partager</span>
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit post modal */}
      <AnimatePresence>
        {editingPost && (
          <EditPostModal
            post={editingPost}
            onClose={() => setEditingPost(null)}
            onSaved={handleEditSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page Card (discovery) ────────────────────────────────────────────────────

function PageCard({
  page,
  index,
  onFollow,
  onOpen,
}: {
  page: PageView;
  index: number;
  onFollow: (id: bigint, isFollowing: boolean) => void;
  onOpen: (page: PageView) => void;
}) {
  const catLabel =
    PAGE_CATEGORIES.find((c) => c.value === page.category)?.label ??
    page.category;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors cursor-pointer"
      data-ocid={`pages.item.${index + 1}`}
      onClick={() => onOpen(page)}
    >
      {/* Cover */}
      <div
        className="h-24 w-full relative overflow-hidden"
        style={
          !page.coverPhotoUrl ? { background: getCoverGradient(page.id) } : {}
        }
      >
        {page.coverPhotoUrl && (
          <img
            src={page.coverPhotoUrl}
            alt={page.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Avatar */}
      <div className="relative px-4" style={{ marginTop: -24 }}>
        <div className="w-12 h-12 rounded-xl border-2 border-card bg-secondary overflow-hidden flex items-center justify-center shadow-md">
          {page.profilePhotoUrl ? (
            <img
              src={page.profilePhotoUrl}
              alt={page.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-bold text-foreground text-base">
              {page.name[0]?.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-1 pb-4 space-y-2">
        <div>
          <h3
            className="font-semibold text-foreground text-sm leading-tight truncate"
            data-ocid={`pages.name.${index + 1}`}
          >
            {page.name}
          </h3>
          <span className="inline-block mt-0.5 text-xs text-primary/80">
            {catLabel}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            {formatCount(page.followerCount)} abonné
            {Number(page.followerCount) !== 1 ? "s" : ""}
          </span>
          <Button
            size="sm"
            variant={page.isFollowing ? "outline" : "default"}
            className="h-7 text-xs px-3"
            data-ocid={`pages.follow_button.${index + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              onFollow(page.id, page.isFollowing);
            }}
          >
            {page.isFollowing ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Abonné
              </>
            ) : (
              "Suivre"
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PagesPage() {
  const { status, profile } = useCurrentUser();
  const navigate = useNavigate();
  const { actor, isFetching } = useAuthenticatedBackend();
  const [showCreate, setShowCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pages, setPages] = useState<PageView[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<PageView | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") void navigate({ to: "/login" });
  }, [status, navigate]);

  const loadPages = useCallback(async () => {
    if (!actor || isFetching) return;
    setPagesLoading(true);
    try {
      const query = searchTerm.trim();
      const result = await actor.searchPages(query);
      setPages(result ?? []);
    } catch {
      /* non-blocking */
    } finally {
      setPagesLoading(false);
    }
  }, [actor, isFetching, searchTerm]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  const handleFollow = async (
    pageId: bigint,
    isCurrentlyFollowing: boolean,
  ) => {
    if (!actor) return;
    try {
      if (isCurrentlyFollowing) {
        const r = await actor.unfollowPage(pageId);
        if (r.__kind__ === "err") throw new Error(r.err);
      } else {
        const r = await actor.followPage(pageId);
        if (r.__kind__ === "err") throw new Error(r.err);
      }
      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                isFollowing: !isCurrentlyFollowing,
                followerCount: isCurrentlyFollowing
                  ? p.followerCount - 1n
                  : p.followerCount + 1n,
              }
            : p,
        ),
      );
    } catch {
      toast.error("Action échouée. Réessayez.");
    }
  };

  const handlePageCreated = (newPage: PageView) => {
    setPages((prev) => [newPage, ...prev]);
  };

  const currentUserId = profile?.id?.toText() ?? null;

  if (status === "initializing") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-6 space-y-4">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  if (status === "unauthenticated") return null;

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedPage) {
    return (
      <Layout>
        <div
          className="max-w-2xl mx-auto py-4 sm:py-6"
          data-ocid="pages.detail_page"
        >
          <button
            type="button"
            onClick={() => setSelectedPage(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            data-ocid="pages.detail.back_button"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux pages
          </button>
          <PageDetailView
            page={selectedPage}
            currentUserId={currentUserId}
            onBack={() => setSelectedPage(null)}
          />
        </div>
      </Layout>
    );
  }

  // ── Discovery view ─────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        className="max-w-2xl mx-auto py-4 sm:py-6 space-y-5"
        data-ocid="pages.page"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Pages
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Découvrez et suivez des pages.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 shrink-0"
            data-ocid="pages.create_button"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Créer une page</span>
            <span className="sm:hidden">Créer</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher une page…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-secondary border-input"
            data-ocid="pages.search_input"
          />
        </div>

        {/* Grid */}
        {pagesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["l1", "l2", "l3", "l4"].map((k) => (
              <Skeleton key={k} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl"
            data-ocid="pages.empty_state"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              {searchTerm ? (
                <Search className="w-8 h-8 text-muted-foreground" />
              ) : (
                <LayoutGrid className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">
              {searchTerm
                ? "Aucune page trouvée"
                : "Aucune page pour l'instant"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {searchTerm
                ? `Aucune page ne correspond à "${searchTerm}".`
                : "Soyez le premier à créer une page sur Zaren Veto."}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setShowCreate(true)}
                className="gap-2"
                data-ocid="pages.empty_create_button"
              >
                <Plus className="w-4 h-4" />
                Créer une page
              </Button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            data-ocid="pages.list"
          >
            {pages.map((page, i) => (
              <PageCard
                key={page.id.toString()}
                page={page}
                index={i}
                onFollow={(id, isFollowing) =>
                  void handleFollow(id, isFollowing)
                }
                onOpen={(p) => setSelectedPage(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreatePageModal
            onClose={() => setShowCreate(false)}
            onCreated={handlePageCreated}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
