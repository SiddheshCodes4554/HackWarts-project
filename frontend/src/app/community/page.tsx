"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useLocation } from "@/context/LocationContext";
import { supabase } from "@/lib/supabaseClient";

type ModerationResult = {
  status: "safe" | "warning" | "blocked";
  reason: string;
  summary: string;
  translation: string;
  tags: string[];
  aiSuggestion: string;
};

type CommunityPost = {
  id: string;
  user_id: string;
  content: string;
  crop_tag: string;
  district: string;
  status: "safe" | "warning" | "blocked";
  created_at: string;
  media_url?: string | null;
  media_type?: "text" | "image" | "voice" | null;
  summary?: string | null;
  ai_tags?: string[] | null;
  ai_suggestion?: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ProfileLite = {
  id: string;
  name: string;
  location_name: string;
  primary_crop: string;
};

type Metrics = {
  likes: number;
  comments: number;
  shares: number;
};

const PAGE_SIZE = 8;
const QUERY_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = QUERY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function getDistrictFromPlace(place: string): string {
  const [district] = place.split(",");
  return district?.trim() || "";
}

function roleOf(profile: unknown): string {
  if (!profile || typeof profile !== "object") return "farmer";
  const value = (profile as Record<string, unknown>).role
    ?? (profile as Record<string, unknown>).user_type
    ?? (profile as Record<string, unknown>).account_type;

  return typeof value === "string" ? value.toLowerCase() : "farmer";
}

function scoreTrending(metrics: Metrics, createdAt: string): number {
  const ageHours = Math.max(1, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  const engagement = metrics.likes * 2 + metrics.comments * 1.5 + metrics.shares;
  return engagement / Math.pow(ageHours, 0.35);
}

export default function CommunityPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const { placeName } = useLocation();

  const preferredDistrict = useMemo(
    () => getDistrictFromPlace(profile?.location_name || placeName || ""),
    [profile?.location_name, placeName],
  );

  const userRole = roleOf(profile as unknown);
  const canPost = userRole !== "buyer";

  const [districtFilter, setDistrictFilter] = useState(preferredDistrict);
  const [cropFilter, setCropFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"latest" | "most_helpful" | "trending">("latest");

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentRow[]>>({});
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [myReactions, setMyReactions] = useState<Record<string, boolean>>({});

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postContent, setPostContent] = useState("");
  const [postCropTag, setPostCropTag] = useState("");
  const [postMediaType, setPostMediaType] = useState<"text" | "image" | "voice">("text");
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [posting, setPosting] = useState(false);

  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    if (!userIds.length) {
      return;
    }

    const profileResult = await withTimeout(
      supabase
        .from("profiles")
        .select("id,name,location_name,primary_crop")
        .in("id", userIds),
      "Fetching profiles",
    ) as { data: ProfileLite[] | null };

    const nextMap: Record<string, ProfileLite> = {};
    (profileResult.data ?? []).forEach((row) => {
      nextMap[row.id] = row;
    });

    setProfileMap((prev) => ({ ...prev, ...nextMap }));
  }, []);

  const fetchPostMeta = useCallback(async (postIds: string[]) => {
    if (!postIds.length) {
      return;
    }

    const [{ data: commentsData }, { data: reactionsData }, { data: sharesData }] = await Promise.all([
      supabase
        .from("comments")
        .select("id,post_id,user_id,content,created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("post_reactions")
        .select("post_id,user_id,reaction_type")
        .in("post_id", postIds),
      supabase
        .from("post_shares")
        .select("post_id")
        .in("post_id", postIds),
    ].map((queryPromise, index) => withTimeout(queryPromise, `Fetching community metadata ${index + 1}`)));

    const byPostComments: Record<string, CommentRow[]> = {};
    (commentsData as CommentRow[] | null)?.forEach((comment) => {
      byPostComments[comment.post_id] = [...(byPostComments[comment.post_id] ?? []), comment];
    });

    const metrics: Record<string, Metrics> = {};
    postIds.forEach((id) => {
      metrics[id] = {
        likes: 0,
        comments: byPostComments[id]?.length ?? 0,
        shares: 0,
      };
    });

    const liked: Record<string, boolean> = {};

    (reactionsData as Array<{ post_id: string; user_id: string; reaction_type: string }> | null)?.forEach((reaction) => {
      if (!metrics[reaction.post_id]) {
        metrics[reaction.post_id] = { likes: 0, comments: 0, shares: 0 };
      }
      if (reaction.reaction_type === "upvote") {
        metrics[reaction.post_id].likes += 1;
      }
      if (reaction.user_id === user?.id) {
        liked[reaction.post_id] = true;
      }
    });

    (sharesData as Array<{ post_id: string }> | null)?.forEach((share) => {
      if (!metrics[share.post_id]) {
        metrics[share.post_id] = { likes: 0, comments: 0, shares: 0 };
      }
      metrics[share.post_id].shares += 1;
    });

    const commenterIds = Array.from(new Set((commentsData as CommentRow[] | null)?.map((row) => row.user_id) ?? []));
    await fetchProfiles(commenterIds);

    setCommentsMap((prev) => ({ ...prev, ...byPostComments }));
    setMetricsMap((prev) => ({ ...prev, ...metrics }));
    setMyReactions((prev) => ({ ...prev, ...liked }));
  }, [fetchProfiles, user?.id]);

  const fetchPosts = useCallback(async (reset = false, forcedPage?: number) => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const targetPage = reset ? 0 : (typeof forcedPage === "number" ? forcedPage : page);
      const start = targetPage * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      let query = supabase
        .from("community_posts")
        .select("*")
        .neq("status", "blocked")
        .order("created_at", { ascending: false })
        .range(start, end);

      const effectiveDistrict = (districtFilter || preferredDistrict).trim();
      if (effectiveDistrict) {
        query = query.eq("district", effectiveDistrict);
      }

      if (cropFilter !== "all") {
        query = query.eq("crop_tag", cropFilter);
      }

      const postsResult = await withTimeout(query, "Fetching community posts") as { data: CommunityPost[] | null; error: { message: string } | null };
      if (postsResult.error) {
        throw postsResult.error;
      }

      const rows = postsResult.data ?? [];
      const nextPosts = reset ? rows : [...posts, ...rows];

      setPosts(nextPosts);
      setHasMore(rows.length === PAGE_SIZE);

      const userIds = Array.from(new Set(nextPosts.map((item) => item.user_id)));
      await fetchProfiles(userIds);

      const postIds = nextPosts.map((item) => item.id);
      await fetchPostMeta(postIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community feed");
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [cropFilter, districtFilter, fetchPostMeta, fetchProfiles, page, posts, preferredDistrict, user]);

  useEffect(() => {
    if (!userLoading && (!user || !profile)) {
      router.replace("/login");
      return;
    }
  }, [profile, router, user, userLoading]);

  useEffect(() => {
    setDistrictFilter(preferredDistrict);
  }, [preferredDistrict]);

  useEffect(() => {
    if (user) {
      setPage(0);
      void fetchPosts(true);
    }
  }, [user, districtFilter, cropFilter]);

  const sortedPosts = useMemo(() => {
    const clone = [...posts];

    if (sortBy === "latest") {
      return clone.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (sortBy === "most_helpful") {
      return clone.sort((a, b) => (metricsMap[b.id]?.likes ?? 0) - (metricsMap[a.id]?.likes ?? 0));
    }

    return clone.sort((a, b) => scoreTrending(metricsMap[b.id] ?? { likes: 0, comments: 0, shares: 0 }, b.created_at)
      - scoreTrending(metricsMap[a.id] ?? { likes: 0, comments: 0, shares: 0 }, a.created_at));
  }, [metricsMap, posts, sortBy]);

  const authorStats = useMemo(() => {
    const stats: Record<string, { posts: number; upvotes: number }> = {};

    posts.forEach((post) => {
      if (!stats[post.user_id]) {
        stats[post.user_id] = { posts: 0, upvotes: 0 };
      }
      stats[post.user_id].posts += 1;
      stats[post.user_id].upvotes += metricsMap[post.id]?.likes ?? 0;
    });

    return stats;
  }, [metricsMap, posts]);

  async function submitPost(event: FormEvent) {
    event.preventDefault();

    if (!user || !canPost) {
      setError("Only farmers can publish in community.");
      return;
    }

    const content = postContent.trim();
    if (!content) {
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const ai = await fetch("/api/community/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          language: profile?.language || "English",
        }),
      }).then((response) => response.json() as Promise<ModerationResult>);

      if (ai.status === "blocked") {
        setError(ai.reason || "Post blocked by AI safety checks.");
        setPosting(false);
        return;
      }

      const payload: Record<string, unknown> = {
        user_id: user.id,
        content,
        crop_tag: postCropTag.trim() || profile?.primary_crop || "General",
        district: (districtFilter || preferredDistrict || "General").trim(),
        status: ai.status,
      };

      const extendedPayload: Record<string, unknown> = {
        ...payload,
        summary: ai.summary,
        ai_tags: ai.tags,
        ai_suggestion: ai.aiSuggestion,
        media_type: postMediaType,
      };

      if (postMediaUrl.trim()) {
        extendedPayload.media_url = postMediaUrl.trim();
      }

      const { error: insertError } = await supabase.from("community_posts").insert(extendedPayload);
      if (insertError) {
        const columnIssue = /column|schema cache|not found|does not exist/i.test(insertError.message || "");
        if (columnIssue) {
          const { error: fallbackInsertError } = await supabase.from("community_posts").insert(payload);
          if (fallbackInsertError) {
            throw fallbackInsertError;
          }
        } else {
          throw insertError;
        }
      }

      setPostContent("");
      setPostCropTag("");
      setPostMediaUrl("");
      setPostMediaType("text");
      setPage(0);
      await fetchPosts(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish post");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!user) return;

    const hasLiked = myReactions[postId];

    if (hasLiked) {
      await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .eq("reaction_type", "upvote");
    } else {
      await supabase.from("post_reactions").upsert({
        post_id: postId,
        user_id: user.id,
        reaction_type: "upvote",
      });
    }

    await fetchPostMeta(posts.map((post) => post.id));
  }

  async function addComment(postId: string) {
    const draft = commentDraft[postId]?.trim();
    if (!user || !draft) return;

    const { error: insertError } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: draft,
    });

    if (!insertError) {
      setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
      await fetchPostMeta(posts.map((post) => post.id));
    }
  }

  async function sharePost(postId: string, content: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Farmer Community Tip",
          text: content,
        });
      } catch {
        // Ignore user canceled share.
      }
    }

    if (user) {
      await supabase.from("post_shares").insert({ post_id: postId, user_id: user.id });
      await fetchPostMeta(posts.map((post) => post.id));
    }
  }

  if (!user || !profile) {
    return <main className="min-h-screen bg-[#f5f8ee]" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f8ee] via-[#ecf5df] to-[#f5f8ee] px-3 py-4 sm:px-5">
      <section className="mx-auto w-full max-w-3xl space-y-4">
        <header className="rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-lime-100">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">Farmer Community</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Knowledge Board for {districtFilter || preferredDistrict}</h1>
          <p className="mt-1 text-sm text-slate-600">Trending tips, crop discussions, and AI-guided safe advice.</p>
        </header>

        <form onSubmit={submitPost} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-lime-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Create Post</h2>
            {!canPost && <span className="text-xs text-amber-700">Buyer accounts cannot post in this community.</span>}
          </div>

          <textarea
            value={postContent}
            onChange={(event) => setPostContent(event.target.value)}
            placeholder="Share your farm update, question, or tip..."
            rows={4}
            className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 outline-none ring-lime-500 focus:ring"
            disabled={!canPost || posting}
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={postCropTag}
              onChange={(event) => setPostCropTag(event.target.value)}
              placeholder="Crop tag (e.g., Tomato)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
              disabled={!canPost || posting}
            />
            <select
              value={postMediaType}
              onChange={(event) => setPostMediaType(event.target.value as "text" | "image" | "voice")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
              disabled={!canPost || posting}
            >
              <option value="text">Text</option>
              <option value="image">Image URL</option>
              <option value="voice">Voice URL</option>
            </select>
            <input
              value={postMediaUrl}
              onChange={(event) => setPostMediaUrl(event.target.value)}
              placeholder={postMediaType === "voice" ? "Voice clip URL" : "Image URL"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
              disabled={!canPost || posting || postMediaType === "text"}
            />
          </div>

          <button
            type="submit"
            disabled={!canPost || posting}
            className="mt-3 w-full rounded-2xl bg-lime-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {posting ? "Publishing..." : "Post to Community"}
          </button>
        </form>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-lime-100">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={districtFilter}
              onChange={(event) => setDistrictFilter(event.target.value)}
              placeholder="District"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
            />
            <input
              value={cropFilter === "all" ? "" : cropFilter}
              onChange={(event) => setCropFilter(event.target.value.trim() || "all")}
              placeholder="Crop filter"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
            />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "latest" | "most_helpful" | "trending")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
            >
              <option value="most_helpful">Most helpful</option>
              <option value="latest">Latest</option>
              <option value="trending">Trending</option>
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>📍 {districtFilter || preferredDistrict}</span>
            <span>🔥 Trending Tips · 🌱 Crop Discussions</span>
          </div>
        </section>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="space-y-4 pb-6">
          {sortedPosts.map((post) => {
            const author = profileMap[post.user_id];
            const metrics = metricsMap[post.id] ?? { likes: 0, comments: 0, shares: 0 };
            const comments = commentsMap[post.id] ?? [];
            const stats = authorStats[post.user_id] ?? { posts: 0, upvotes: 0 };
            const experienced = stats.posts >= 6 || stats.upvotes >= 20;
            const verified = stats.posts >= 12 && stats.upvotes >= 50;

            return (
              <article key={post.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-lime-100">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">👨‍🌾 {author?.name || "Farmer"}</p>
                      <p className="text-xs text-slate-500">{author?.location_name || post.district} · {new Date(post.created_at).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-lime-100 px-2 py-1 text-xs font-medium text-lime-800">{post.crop_tag}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {experienced && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">🌟 Experienced Farmer</span>}
                    {verified && <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">🧪 Verified Expert</span>}
                    {post.status === "warning" && <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">AI: Needs Verification</span>}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-800">{post.content}</p>

                  {post.media_type === "image" && post.media_url && (
                    <img
                      src={post.media_url}
                      alt="Post media"
                      loading="lazy"
                      className="mt-3 h-52 w-full rounded-2xl object-cover"
                    />
                  )}

                  {post.media_type === "voice" && post.media_url && (
                    <audio controls className="mt-3 w-full" preload="none">
                      <source src={post.media_url} />
                    </audio>
                  )}

                  {(post.summary || post.ai_suggestion) && (
                    <div className="mt-3 rounded-2xl bg-emerald-50 p-3">
                      {post.summary && <p className="text-xs text-emerald-900"><strong>Summary:</strong> {post.summary}</p>}
                      {post.ai_suggestion && <p className="mt-1 text-xs text-emerald-900"><strong>AI Suggestion:</strong> {post.ai_suggestion}</p>}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-5 text-sm text-slate-600">
                    <button onClick={() => void toggleLike(post.id)} className="font-medium text-slate-700">
                      👍 {metrics.likes}
                    </button>
                    <span>💬 {metrics.comments}</span>
                    <button onClick={() => void sharePost(post.id, post.content)} className="font-medium text-slate-700">
                      🔗 {metrics.shares}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={commentDraft[post.id] ?? ""}
                        onChange={(event) => setCommentDraft((prev) => ({ ...prev, [post.id]: event.target.value }))}
                        placeholder="Write a comment"
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-lime-500 focus:ring"
                      />
                      <button
                        onClick={() => void addComment(post.id)}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Comment
                      </button>
                    </div>

                    {comments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <span className="font-semibold">{profileMap[comment.user_id]?.name || "User"}:</span> {comment.content}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}

          {loading && <p className="text-center text-sm text-slate-500">Loading feed...</p>}

          {!loading && hasMore && (
            <button
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                void fetchPosts(false, nextPage);
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Load More
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
