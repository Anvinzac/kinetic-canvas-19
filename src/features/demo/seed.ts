import {
  COMMENT_CHIPS,
  serializeCanvas,
  TRANSITION_GRADIENT_PATHS,
  type CanvasSpec,
} from "@/lib/canvas";
import { DEMO_AUTH_USER_ID } from "@/features/session";
import { DEMO_STATUS_PHOTOS } from "@/lib/post-media";
import type {
  SocialComment,
  SocialDiscoverData,
  SocialFeedData,
  SocialLike,
  SocialMeData,
  SocialNotificationItem,
  SocialNotificationsData,
  SocialPost,
  SocialPostData,
  SocialProfile,
  SocialProfileData,
  SocialSearchData,
} from "@/shared/types";

/** @responsibility Stable demo viewer profile id used across seed overlays and mutations. */
export const MOCK_ME_ID = "11111111-1111-4111-8111-111111111111";

/** @responsibility Demo viewer username for /me redirects and profile lookup. */
export const MOCK_ME_USERNAME = "demo_creator";

const DEMO_TRANSITION_GRADIENTS = [
  ...(TRANSITION_GRADIENT_PATHS[0]?.gradients ?? [
    "linear-gradient(135deg,#FF006E,#8338EC)",
    "linear-gradient(135deg,#3A86FF,#06FFA5)",
    "linear-gradient(135deg,#FFBE0B,#FF006E)",
  ]),
];

/** @deprecated Prefer SocialProfile from `@/shared/types`
 * @responsibility Demo profile row shape (includes seed-only auth/bio/created_at fields). */
export type MockProfile = SocialProfile & {
  auth_user_id: string | null;
  bio: string | null;
  created_at: string;
};

/** @deprecated Prefer SocialPost from `@/shared/types`
 * @responsibility Demo post row shape used by seed data and local overlays. */
export type MockPost = SocialPost;

/** @deprecated Prefer SocialLike from `@/shared/types`
 * @responsibility Demo like edge including created_at for notification ordering. */
export type MockLike = SocialLike & { created_at: string };

/** @deprecated Prefer SocialComment from `@/shared/types`
 * @responsibility Demo comment row used by seed bursts and local overlays. */
export type MockComment = SocialComment;

/** @responsibility Follow edge between two demo profiles. */
export type MockFollow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

/** @deprecated Prefer SocialFeedData from `@/shared/types`
 * @responsibility Bundle returned by getMockFeed. */
export type MockFeedData = SocialFeedData;

/** @deprecated Prefer SocialPostData from `@/shared/types`
 * @responsibility Bundle returned by getMockPost. */
export type MockPostData = SocialPostData;

/** @deprecated Prefer SocialProfileData from `@/shared/types`
 * @responsibility Bundle returned by getMockProfile. */
export type MockProfileData = SocialProfileData;

/** @deprecated Prefer SocialMeData from `@/shared/types`
 * @responsibility Bundle returned by getMockMe. */
export type MockMeData = SocialMeData;

/** @deprecated Prefer SocialDiscoverData from `@/shared/types`
 * @responsibility Bundle returned by getMockDiscover. */
export type MockDiscoverData = SocialDiscoverData;

/** @deprecated Prefer SocialSearchData from `@/shared/types`
 * @responsibility Bundle returned by searchMock. */
export type MockSearchData = SocialSearchData;

/** @deprecated Prefer SocialNotificationItem from `@/shared/types`
 * @responsibility One notification row in the demo activity feed. */
export type MockNotificationItem = SocialNotificationItem;

/** @deprecated Prefer SocialNotificationsData from `@/shared/types`
 * @responsibility Bundle returned by getMockNotifications. */
export type MockNotificationsData = SocialNotificationsData;

/** @responsibility Canonical demo profiles (viewer + creators + vocab bot). */
export const MOCK_PROFILES: MockProfile[] = [
  {
    id: MOCK_ME_ID,
    auth_user_id: DEMO_AUTH_USER_ID,
    username: MOCK_ME_USERNAME,
    display_name: "Demo Creator",
    avatar_url: "https://i.pravatar.cc/240?u=demo_creator",
    bio: "Testing every moving-word flow before it ships.",
    created_at: "2026-05-28T08:30:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    auth_user_id: null,
    username: "nova_rae",
    display_name: "Nova Rae",
    avatar_url: "https://i.pravatar.cc/240?u=nova_rae",
    bio: "High-contrast typography, soft landings, loud feelings.",
    created_at: "2026-04-17T12:12:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    auth_user_id: null,
    username: "kai_loop",
    display_name: "Kai Loop",
    avatar_url: "https://i.pravatar.cc/240?u=kai_loop",
    bio: "Loops for creators who think in beats.",
    created_at: "2026-04-23T15:45:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    auth_user_id: null,
    username: "mira_aux",
    display_name: "Mira Aux",
    avatar_url: "https://i.pravatar.cc/240?u=mira_aux",
    bio: "I turn tiny notes into kinetic postcards.",
    created_at: "2026-05-02T11:05:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    auth_user_id: null,
    username: "zeph_404",
    display_name: "Zeph 404",
    avatar_url: "https://i.pravatar.cc/240?u=zeph_404",
    bio: "Glitch language, video overlays, and borrowed neon.",
    created_at: "2026-05-11T20:22:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    auth_user_id: null,
    username: "lila_om",
    display_name: "Lila Om",
    avatar_url: "https://i.pravatar.cc/240?u=lila_om",
    bio: "Quiet captions that still know how to move.",
    created_at: "2026-05-20T06:18:00.000Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    auth_user_id: null,
    username: "do_chu_bot",
    display_name: "Đố Chữ Mỗi Ngày",
    avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=dochu&backgroundColor=8338EC,3A86FF",
    bio: "🤖 Mỗi ngày một từ tiếng Anh — đoán nghĩa qua gợi ý tiếng Việt.",
    created_at: "2026-05-30T05:00:00.000Z",
  },
];

const VOCAB_BOT_ID = "77777777-7777-4777-8777-777777777777";
const NOVA_RAE_ID = "22222222-2222-4222-8222-222222222222";

// Showcase posts for the seamless *pattern* backdrops (canvas-patterns.ts) —
// non-gradient textures that pan a step per page. Each is multi-page so the
// drift is visible as you tap through. Tap to watch the texture slide.
const PATTERN_SHOWCASE_POSTS: MockPost[] = [
  {
    id: "9a000001-0001-4001-8001-000000000001",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Some nights", "the scroll", "feels infinite."].join("\n"),
      backgroundPattern: "starfield",
      font: "Space Grotesk",
      size: 80,
      entrance: "fade",
      loop: "float",
      tempo: "slow",
      rhythm: "smooth",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:06:00.000Z",
  },
  {
    id: "9a000002-0002-4002-8002-000000000002",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Every idea", "starts as", "a rough draft."].join("\n"),
      backgroundPattern: "blueprint",
      font: "JetBrains Mono",
      size: 74,
      entrance: "slide",
      loop: "none",
      tempo: "steady",
      rhythm: "stagger",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:05:00.000Z",
  },
  {
    id: "9a000003-0003-4003-8003-000000000003",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Print is dead.", "Long live", "the dot."].join("\n"),
      backgroundPattern: "halftone",
      font: "Bebas Neue",
      size: 96,
      entrance: "scale",
      loop: "pulse",
      tempo: "snappy",
      rhythm: "burst",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:04:00.000Z",
  },
  {
    id: "9a000004-0004-4004-8004-000000000004",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Slow down.", "Then don't.", "Go."].join("\n"),
      backgroundPattern: "hazard",
      font: "Space Grotesk",
      size: 88,
      entrance: "split",
      loop: "shake",
      tempo: "snappy",
      rhythm: "burst",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:03:00.000Z",
  },
  {
    id: "9a000005-0005-4005-8005-000000000005",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Pattern", "recognition", "is a love language."].join("\n"),
      backgroundPattern: "argyle",
      font: "Playfair Display",
      size: 78,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "smooth",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:02:00.000Z",
  },
  {
    id: "9a000006-0006-4006-8006-000000000006",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Beauty", "hides in", "the imperfect."].join("\n"),
      backgroundPattern: "terrazzo",
      font: "Playfair Display",
      size: 82,
      entrance: "fade",
      loop: "pulse",
      tempo: "steady",
      rhythm: "stagger",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:01:00.000Z",
  },
  {
    id: "9a000007-0007-4007-8007-000000000007",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["The day", "lets go", "in color."].join("\n"),
      backgroundScene: "alpenglow",
      font: "Playfair Display",
      size: 82,
      color: "#fdf3e0",
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:08:00.000Z",
  },
  {
    id: "9a000008-0008-4008-8008-000000000008",
    author_id: NOVA_RAE_ID,
    post_type: "text",
    canvas_html: canvas({
      text: ["Build it tall,", "make it", "golden."].join("\n"),
      backgroundScene: "deco",
      font: "Bebas Neue",
      size: 96,
      color: "#f6e6c2",
      entrance: "slide",
      loop: "none",
      tempo: "steady",
      rhythm: "stagger",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-22T11:07:00.000Z",
  },
];

/** @responsibility Canonical demo posts (pattern showcase, vocab bot, creator feed). */
export const MOCK_POSTS: MockPost[] = [
  ...PATTERN_SHOWCASE_POSTS,
  {
    id: "70707070-7021-4721-8721-707070700021",
    author_id: VOCAB_BOT_ID,
    post_type: "text",
    canvas_html: canvas({
      text: [
        "Mùi đất thơm dịu sau cơn mưa đầu mùa.",
        "Từ này bắt đầu bằng chữ P.",
        "Cả từ gồm 9 chữ cái.",
        "Đoán tiếp nào, bạn tìm ra chứ?",
        "Petrichor",
      ].join("\n"),
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "fade",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-20T18:08:42.902Z",
  },
  {
    id: "70707070-7022-4722-8722-707070700022",
    author_id: VOCAB_BOT_ID,
    post_type: "text",
    canvas_html: canvas({
      text: [
        "Niềm vui bất ngờ khi gặp điều may mắn.",
        "Từ này bắt đầu bằng chữ S.",
        "Cả từ gồm 11 chữ cái.",
        "Thử đoán xem, bạn tìm ra không?",
        "Serendipity",
      ].join("\n"),
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "scale",
      loop: "pulse",
      tempo: "steady",
      rhythm: "stagger",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#F72585,#7209B7)",
    created_at: "2026-06-21T07:00:00.191Z",
  },
  {
    id: "70707070-7023-4723-8723-707070700023",
    author_id: VOCAB_BOT_ID,
    post_type: "text",
    canvas_html: canvas({
      text: [
        "Thứ tồn tại rất ngắn, thoáng qua rồi tan.",
        "Từ này bắt đầu bằng chữ E.",
        "Cả từ gồm 9 chữ cái.",
        "Đoán tiếp đi, bạn nghĩ ra chưa?",
        "Ephemeral",
      ].join("\n"),
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "slide",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#8338EC)",
    created_at: "2026-06-21T13:00:00.188Z",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    author_id: MOCK_ME_ID,
    post_type: "text",
    canvas_html: canvas({
      text: "Start with the smallest clear promise. Let the first frame breathe. Give every sentence one job. Make the rhythm easy to follow. Leave the final page glowing.",
      font: "Space Grotesk",
      size: 82,
      color: "#ffffff",
      entrance: "scale",
      loop: "pulse",
      backgroundStyle: "transition",
      gradientPath: DEMO_TRANSITION_GRADIENTS,
    }),
    media_urls: [],
    bg_gradient: DEMO_TRANSITION_GRADIENTS[0] ?? "linear-gradient(135deg,#FF006E,#8338EC)",
    created_at: "2026-06-16T07:20:00.000Z",
  },
  {
    id: "19191919-0619-4619-8619-191919191919",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "image",
    canvas_html: canvas({
      text: [
        "Ao thu lạnh lẽo nước trong veo,",
        "Một chiếc thuyền câu bé tẻo teo.",
        "Sóng biếc theo làn hơi gợn tí,",
        "Lá vàng trước gió khẽ đưa vèo.",
        "Tầng mây lơ lửng trời xanh ngắt,",
        "Ngõ trúc quanh co khách vắng teo.",
        "Tựa gối buông cần lâu chẳng được,",
        "Cá đâu đớp động dưới chân bèo.",
      ].join("\n"),
      font: "Playfair Display",
      size: 72,
      color: "#FFF7ED",
      weight: 700,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      y: 54,
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#F8C8DC,#7C3AED)",
    created_at: "2026-06-16T07:19:30.000Z",
  },
  {
    id: "dadadada-dada-4ada-8ada-dadadadada05",
    author_id: MOCK_ME_ID,
    post_type: "image",
    canvas_html: canvas({
      text: "Tiếng Việt cần khoảng thở dài hơn một chút. Mỗi trang nên giữ trọn một ý rõ. Dấu sắc dấu huyền cũng tạo nhịp riêng. Khi chữ hiện chậm, cảm xúc dễ bám hơn. Người đọc có thể nhớ câu cuối lâu hơn. Đây là bài thử cho nhịp hấp thụ.",
      font: "Inter",
      size: 70,
      color: "#ffffff",
      entrance: "fade",
      loop: "float",
      tempo: "slow",
    }),
    media_urls: [DEMO_STATUS_PHOTOS.vietnameseRhythm],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-16T07:19:00.000Z",
  },
  {
    id: "bebebebe-bebe-4ebe-8ebe-bebebebebe06",
    author_id: "33333333-3333-4333-8333-333333333333",
    post_type: "image",
    canvas_html: canvas({
      text: "Nếu thông tin dày, mở bằng hình ảnh quen. Sau đó đặt luận điểm ở giữa màn hình. Đừng ép người xem hiểu quá nhanh. Cho họ một nhịp để tự đồng ý. Khi trang đổi, ý mới mới bắt đầu. Nội dung tốt cần thở cùng người đọc.",
      font: "Inter",
      size: 70,
      color: "#ffffff",
      entrance: "blur",
      loop: "pulse",
      tempo: "steady",
    }),
    media_urls: [DEMO_STATUS_PHOTOS.denseInfo],
    bg_gradient: "linear-gradient(135deg,#FFBE0B,#06FFA5)",
    created_at: "2026-06-16T07:18:00.000Z",
  },
  {
    id: "fafafafa-fafa-4afa-8afa-fafafafafa07",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "image",
    canvas_html: canvas({
      text: "Buổi sáng ở Hà Nội có màu rất mềm. Một câu ngắn có thể giữ lại hơi sương. Tôi muốn chữ đi qua như tiếng xe xa. Không cần quá nhanh, chỉ cần đủ gần. Đọc xong vẫn còn một chút lặng. Hãy để mắt tự chọn nơi dừng.",
      font: "Inter",
      size: 68,
      color: "#ffffff",
      entrance: "slide",
      loop: "float",
      tempo: "steady",
      rotation: -1,
    }),
    media_urls: [DEMO_STATUS_PHOTOS.hanoiMorning],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#7209B7)",
    created_at: "2026-06-16T07:16:00.000Z",
  },
  {
    id: "91919191-9191-4919-8919-919191919108",
    author_id: "66666666-6666-4666-8666-666666666666",
    post_type: "image",
    canvas_html: canvas({
      text: "Trong một cuộc trò chuyện, tốc độ không phải tất cả. Có lúc câu trả lời hay nhất là im lặng. Chữ chuyển động nên giống hơi thở. Vào đúng lúc, ra đúng lúc. Người xem sẽ tự theo nếu nhịp thật.",
      font: "Inter",
      size: 72,
      color: "#ffffff",
      entrance: "scale",
      loop: "none",
      tempo: "snappy",
    }),
    media_urls: [DEMO_STATUS_PHOTOS.conversation],
    bg_gradient: "linear-gradient(135deg,#F72585,#118AB2)",
    created_at: "2026-06-16T07:14:00.000Z",
  },
  {
    id: "abababab-abab-4aba-8aba-ababababab01",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "image",
    canvas_html: canvas({
      text: "Một ý tưởng nhỏ cũng cần nhịp. Hãy để câu đầu thở. Rồi ánh sáng tự tìm người.",
      font: "Inter",
      size: 78,
      color: "#ffffff",
      entrance: "fade",
      loop: "float",
      tempo: "steady",
    }),
    media_urls: [DEMO_STATUS_PHOTOS.smallIdea],
    bg_gradient: "linear-gradient(135deg,#118AB2,#06D6A0)",
    created_at: "2026-06-16T07:17:00.000Z",
  },
  {
    id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02",
    author_id: "33333333-3333-4333-8333-333333333333",
    post_type: "text",
    canvas_html: canvas({
      text: "Đừng vội làm mọi thứ rực rỡ. Một khoảng lặng đủ giữ mắt. Một chữ đúng cũng biết sáng.",
      font: "Inter",
      size: 74,
      color: "#ffffff",
      entrance: "blur",
      loop: "pulse",
      tempo: "slow",
      backgroundPattern: "chevron",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-16T07:12:00.000Z",
  },
  {
    id: "efefefef-efef-4efe-8efe-efefefefef03",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "text",
    canvas_html: canvas({
      text: "Sài Gòn chậm lại sau cơn mưa. Màn hình sáng như một quán nhỏ. Ai cũng có câu chuyện riêng.",
      font: "Inter",
      size: 72,
      color: "#ffffff",
      entrance: "slide",
      loop: "float",
      tempo: "steady",
      rotation: -1,
      backgroundPattern: "circuit",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-16T07:08:00.000Z",
  },
  {
    id: "acacacac-acac-4aca-8aca-acacacacac04",
    author_id: "66666666-6666-4666-8666-666666666666",
    post_type: "image",
    canvas_html: canvas({
      text: "Bữa cơm tối cần nhiều tiếng cười. Tin nhắn dài để dành sau. Trước hết hãy ngồi thật gần.",
      font: "Inter",
      size: 76,
      color: "#ffffff",
      entrance: "scale",
      loop: "none",
      tempo: "snappy",
    }),
    media_urls: [DEMO_STATUS_PHOTOS.dinnerTable],
    bg_gradient: null,
    created_at: "2026-06-16T07:03:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "link",
    canvas_html: canvas({
      text: "The best interfaces explain themselves before the user needs a tooltip.",
      font: "Playfair Display",
      size: 74,
      color: "#17140f",
      entrance: "blur",
      loop: "float",
      link: {
        url: "https://www.nngroup.com/articles/designing-effective-carousels/",
        host: "nngroup.com",
        title: "The best interfaces explain themselves before the user needs a tooltip.",
      },
    }),
    media_urls: ["https://www.nngroup.com/articles/designing-effective-carousels/"],
    bg_gradient: "linear-gradient(135deg,#FFD60A,#FF006E)",
    created_at: "2026-06-16T07:06:00.000Z",
  },
  {
    id: "bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcb3",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "image",
    canvas_html: canvas({
      text: "Make the first frame honest. Let the second frame surprise them. Leave the last frame glowing.",
      font: "Bebas Neue",
      size: 90,
      color: "#ffffff",
      entrance: "slide",
      loop: "float",
      y: 46,
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-16T06:58:00.000Z",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    author_id: "33333333-3333-4333-8333-333333333333",
    post_type: "text",
    canvas_html: canvas({
      text: "Tiny drafts count. Slow mornings count. The loop is proof you came back.",
      font: "Playfair Display",
      size: 76,
      color: "#ffffff",
      entrance: "blur",
      loop: "float",
      rotation: -2,
      backgroundPattern: "waves",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-16T06:32:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "slideshow",
    canvas_html: canvas({
      text: "Archive the spark before it cools. Name the version you want to remember.",
      font: "Inter",
      size: 72,
      color: "#ffffff",
      entrance: "fade",
      loop: "pulse",
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#06FFA5)",
    created_at: "2026-06-16T05:49:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    author_id: "55555555-5555-4555-8555-555555555555",
    post_type: "video",
    canvas_html: canvas({
      text: "Motion is a shortcut to memory. Give the sentence somewhere to land.",
      font: "JetBrains Mono",
      size: 64,
      color: "#06FFA5",
      entrance: "split",
      loop: "shake",
      y: 55,
    }),
    media_urls: ["https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-15T22:15:00.000Z",
  },
  {
    id: "ffffffff-ffff-4fff-8fff-fffffffffff6",
    author_id: "66666666-6666-4666-8666-666666666666",
    post_type: "text",
    canvas_html: canvas({
      text: "A small pause can make the whole post breathe.",
      font: "Space Grotesk",
      size: 86,
      color: "#ffffff",
      entrance: "fade",
      loop: "none",
      backgroundPattern: "hexagons",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-15T18:40:00.000Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    author_id: "22222222-2222-4222-8222-222222222222",
    post_type: "text",
    canvas_html: canvas({
      text: "If the line feels flat, change the entrance before you change the thought.",
      font: "Bebas Neue",
      size: 92,
      color: "#ffffff",
      entrance: "slide",
      loop: "pulse",
      backgroundPattern: "isometric",
    }),
    media_urls: [],
    bg_gradient: null,
    created_at: "2026-06-15T12:25:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    author_id: "33333333-3333-4333-8333-333333333333",
    post_type: "text",
    canvas_html: canvas({
      text: "You can publish the draft and still protect the deeper work.",
      font: "Inter",
      size: 78,
      color: "#ffffff",
      entrance: "scale",
      loop: "float",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#F72585,#7209B7)",
    created_at: "2026-06-14T21:02:00.000Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    author_id: MOCK_ME_ID,
    post_type: "text",
    canvas_html: canvas({
      text: "Test the replay button. Test the comment timing. Test the feeling after the fade.",
      font: "JetBrains Mono",
      size: 62,
      color: "#06FFA5",
      entrance: "blur",
      loop: "pulse",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-14T14:18:00.000Z",
  },
  {
    id: "12121212-1212-4212-8212-121212121212",
    author_id: "44444444-4444-4444-8444-444444444444",
    post_type: "image",
    canvas_html: canvas({
      text: "A good background should hold the sentence, not steal it.",
      font: "Playfair Display",
      size: 74,
      color: "#ffffff",
      entrance: "fade",
      loop: "float",
    }),
    media_urls: [
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
    ],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#8338EC)",
    created_at: "2026-06-14T09:35:00.000Z",
  },
];

/** @responsibility Canonical demo like edges used before local overlays apply. */
export const MOCK_LIKES: MockLike[] = [
  like(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:23:00.000Z",
  ),
  like(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-16T07:25:00.000Z",
  ),
  like(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "44444444-4444-4444-8444-444444444444",
    "2026-06-16T07:29:00.000Z",
  ),
  like("19191919-0619-4619-8619-191919191919", MOCK_ME_ID, "2026-06-16T07:20:00.000Z"),
  like(
    "19191919-0619-4619-8619-191919191919",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:22:00.000Z",
  ),
  like(
    "19191919-0619-4619-8619-191919191919",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-16T07:25:00.000Z",
  ),
  like("dadadada-dada-4ada-8ada-dadadadada05", MOCK_ME_ID, "2026-06-16T07:20:00.000Z"),
  like(
    "dadadada-dada-4ada-8ada-dadadadada05",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:22:00.000Z",
  ),
  like(
    "dadadada-dada-4ada-8ada-dadadadada05",
    "44444444-4444-4444-8444-444444444444",
    "2026-06-16T07:26:00.000Z",
  ),
  like("bebebebe-bebe-4ebe-8ebe-bebebebebe06", MOCK_ME_ID, "2026-06-16T07:19:00.000Z"),
  like(
    "bebebebe-bebe-4ebe-8ebe-bebebebebe06",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-16T07:23:00.000Z",
  ),
  like("fafafafa-fafa-4afa-8afa-fafafafafa07", MOCK_ME_ID, "2026-06-16T07:17:00.000Z"),
  like(
    "fafafafa-fafa-4afa-8afa-fafafafafa07",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-16T07:20:00.000Z",
  ),
  like("91919191-9191-4919-8919-919191919108", MOCK_ME_ID, "2026-06-16T07:15:00.000Z"),
  like("abababab-abab-4aba-8aba-ababababab01", MOCK_ME_ID, "2026-06-16T07:18:00.000Z"),
  like(
    "abababab-abab-4aba-8aba-ababababab01",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-16T07:21:00.000Z",
  ),
  like("cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02", MOCK_ME_ID, "2026-06-16T07:14:00.000Z"),
  like(
    "efefefef-efef-4efe-8efe-efefefefef03",
    "55555555-5555-4555-8555-555555555555",
    "2026-06-16T07:11:00.000Z",
  ),
  like("acacacac-acac-4aca-8aca-acacacacac04", MOCK_ME_ID, "2026-06-16T07:06:00.000Z"),
  like("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", MOCK_ME_ID, "2026-06-16T07:04:00.000Z"),
  like(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-16T07:08:00.000Z",
  ),
  like("cccccccc-cccc-4ccc-8ccc-ccccccccccc3", MOCK_ME_ID, "2026-06-16T06:45:00.000Z"),
  like(
    "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-16T06:52:00.000Z",
  ),
  like("dddddddd-dddd-4ddd-8ddd-ddddddddddd4", MOCK_ME_ID, "2026-06-16T06:01:00.000Z"),
  like(
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-15T22:22:00.000Z",
  ),
  like("ffffffff-ffff-4fff-8fff-fffffffffff6", MOCK_ME_ID, "2026-06-15T19:11:00.000Z"),
  like(
    "99999999-9999-4999-8999-999999999999",
    "55555555-5555-4555-8555-555555555555",
    "2026-06-14T14:30:00.000Z",
  ),
  like(
    "99999999-9999-4999-8999-999999999999",
    "66666666-6666-4666-8666-666666666666",
    "2026-06-14T14:37:00.000Z",
  ),
];

// Dense flying-chip bursts on the first feed posts (demo overflow stress-test).
const CHIP_BURST_POST_IDS = [
  "9a000001-0001-4001-8001-000000000001",
  "9a000002-0002-4002-8002-000000000002",
  "9a000007-0007-4007-8007-000000000007",
  "dadadada-dada-4ada-8ada-dadadadada05",
  "91919191-9191-4919-8919-919191919108",
] as const;

const CHIP_BURST_USER_IDS = [
  MOCK_ME_ID,
  NOVA_RAE_ID,
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
] as const;

function buildChipBurstComments(): MockComment[] {
  const burst: MockComment[] = [];
  let sequence = 1;

  for (const postId of CHIP_BURST_POST_IDS) {
    for (let index = 0; index < 26; index += 1) {
      const chip = COMMENT_CHIPS[index % COMMENT_CHIPS.length];
      burst.push(
        comment(
          `b${String(sequence).padStart(7, "0")}-4000-8000-${String(sequence).padStart(12, "0")}`,
          postId,
          CHIP_BURST_USER_IDS[index % CHIP_BURST_USER_IDS.length],
          chip.id,
          `2026-06-22T11:${String(index % 60).padStart(2, "0")}:${String((index * 5) % 60).padStart(2, "0")}.000Z`,
        ),
      );
      sequence += 1;
    }
  }

  return burst;
}

/** @responsibility Canonical demo comments including chip-burst stress fixtures. */
export const MOCK_COMMENTS: MockComment[] = [
  ...buildChipBurstComments(),
  comment(
    "10000000-0000-4000-8000-000000000001",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "22222222-2222-4222-8222-222222222222",
    "The rhythm is clear and the final phrase actually lands",
    "2026-06-16T07:24:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000030",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "55555555-5555-4555-8555-555555555555",
    "fire",
    "2026-06-16T07:25:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000002",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "33333333-3333-4333-8333-333333333333",
    "I would save this because it explains the whole app",
    "2026-06-16T07:28:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000031",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "66666666-6666-4666-8666-666666666666",
    "mind-blown",
    "2026-06-16T07:29:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000003",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "44444444-4444-4444-8444-444444444444",
    "The sentence has space without losing its urgency",
    "2026-06-16T07:31:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000020",
    "19191919-0619-4619-8619-191919191919",
    "33333333-3333-4333-8333-333333333333",
    "Tám trang đọc từng câu rất hợp bài thơ",
    "2026-06-16T07:23:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000032",
    "19191919-0619-4619-8619-191919191919",
    "66666666-6666-4666-8666-666666666666",
    "dịu ghê",
    "2026-06-16T07:24:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000021",
    "19191919-0619-4619-8619-191919191919",
    MOCK_ME_ID,
    "Nền nước và núi làm câu thu dịu hơn",
    "2026-06-16T07:26:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000015",
    "dadadada-dada-4ada-8ada-dadadadada05",
    "22222222-2222-4222-8222-222222222222",
    "Bài này giúp kiểm tra nhịp đọc rất rõ",
    "2026-06-16T07:21:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000033",
    "dadadada-dada-4ada-8ada-dadadadada05",
    "55555555-5555-4555-8555-555555555555",
    "đúng nhịp",
    "2026-06-16T07:22:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000016",
    "dadadada-dada-4ada-8ada-dadadadada05",
    "33333333-3333-4333-8333-333333333333",
    "Mười từ mỗi trang nghe tự nhiên hơn",
    "2026-06-16T07:27:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000017",
    "bebebebe-bebe-4ebe-8ebe-bebebebebe06",
    "66666666-6666-4666-8666-666666666666",
    "Luận điểm hiện từng trang nên dễ giữ lại",
    "2026-06-16T07:24:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000034",
    "bebebebe-bebe-4ebe-8ebe-bebebebebe06",
    "33333333-3333-4333-8333-333333333333",
    "rất rõ",
    "2026-06-16T07:25:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000018",
    "fafafafa-fafa-4afa-8afa-fafafafafa07",
    MOCK_ME_ID,
    "Không khí Hà Nội chuyển thành nhịp khá mềm",
    "2026-06-16T07:18:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000035",
    "fafafafa-fafa-4afa-8afa-fafafafafa07",
    "22222222-2222-4222-8222-222222222222",
    "êm thật",
    "2026-06-16T07:19:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000019",
    "91919191-9191-4919-8919-919191919108",
    "44444444-4444-4444-8444-444444444444",
    "Câu về hơi thở rất hợp với animation",
    "2026-06-16T07:16:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000011",
    "abababab-abab-4aba-8aba-ababababab01",
    "44444444-4444-4444-8444-444444444444",
    "Nhịp này rất hợp với tiếng Việt",
    "2026-06-16T07:19:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000012",
    "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02",
    "66666666-6666-4666-8666-666666666666",
    "Khoảng lặng làm câu sáng hơn thật",
    "2026-06-16T07:15:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000013",
    "efefefef-efef-4efe-8efe-efefefefef03",
    MOCK_ME_ID,
    "Cảm giác thành phố sau mưa rất rõ",
    "2026-06-16T07:12:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000014",
    "acacacac-acac-4aca-8aca-acacacacac04",
    "22222222-2222-4222-8222-222222222222",
    "Dòng cuối nghe rất ấm",
    "2026-06-16T07:07:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000004",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    MOCK_ME_ID,
    "This one makes the image feel like part of the argument",
    "2026-06-16T07:06:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000005",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    "66666666-6666-4666-8666-666666666666",
    "The second beat surprised me in a good way",
    "2026-06-16T07:10:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000006",
    "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    MOCK_ME_ID,
    "Tiny drafts count is exactly the reminder I needed",
    "2026-06-16T06:48:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000007",
    "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    MOCK_ME_ID,
    "The slideshow waits for the sentence and that feels right",
    "2026-06-16T05:58:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000008",
    "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
    "55555555-5555-4555-8555-555555555555",
    "I like that the archive idea feels calm instead of precious",
    "2026-06-16T06:03:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000009",
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5",
    "22222222-2222-4222-8222-222222222222",
    "The motion makes the memory line feel almost physical",
    "2026-06-15T22:25:00.000Z",
  ),
  comment(
    "10000000-0000-4000-8000-000000000010",
    "99999999-9999-4999-8999-999999999999",
    "66666666-6666-4666-8666-666666666666",
    "This is useful because it tests replay timing and comment pacing",
    "2026-06-14T14:39:00.000Z",
  ),
];

/** @responsibility Canonical demo follow edges used before local overlays apply. */
export const MOCK_FOLLOWS: MockFollow[] = [
  follow(MOCK_ME_ID, "22222222-2222-4222-8222-222222222222", "2026-06-01T09:00:00.000Z"),
  follow(MOCK_ME_ID, "33333333-3333-4333-8333-333333333333", "2026-06-01T09:05:00.000Z"),
  follow(MOCK_ME_ID, "44444444-4444-4444-8444-444444444444", "2026-06-01T09:10:00.000Z"),
  follow(MOCK_ME_ID, "55555555-5555-4555-8555-555555555555", "2026-06-01T09:15:00.000Z"),
  follow(MOCK_ME_ID, "66666666-6666-4666-8666-666666666666", "2026-06-01T09:20:00.000Z"),
  follow("22222222-2222-4222-8222-222222222222", MOCK_ME_ID, "2026-06-10T16:15:00.000Z"),
  follow("33333333-3333-4333-8333-333333333333", MOCK_ME_ID, "2026-06-12T11:42:00.000Z"),
  follow("44444444-4444-4444-8444-444444444444", MOCK_ME_ID, "2026-06-15T18:19:00.000Z"),
  follow(
    "66666666-6666-4666-8666-666666666666",
    "22222222-2222-4222-8222-222222222222",
    "2026-06-05T13:40:00.000Z",
  ),
  follow(
    "55555555-5555-4555-8555-555555555555",
    "33333333-3333-4333-8333-333333333333",
    "2026-06-07T20:12:00.000Z",
  ),
];

function canvas(overrides: Partial<CanvasSpec>) {
  return serializeCanvas({
    text: "TYPE.",
    font: "Space Grotesk",
    size: 86,
    color: "#ffffff",
    weight: 900,
    letterSpacing: -0.03,
    x: 50,
    y: 50,
    entrance: "scale",
    loop: "pulse",
    tempo: "steady",
    rhythm: "stagger",
    rotation: 0,
    ...overrides,
  });
}

function like(post_id: string, user_id: string, created_at: string): MockLike {
  return { post_id, user_id, created_at };
}

function comment(
  id: string,
  post_id: string,
  user_id: string,
  chip_id: string,
  created_at: string,
): MockComment {
  return { id, post_id, user_id, chip_id, created_at };
}

/** @responsibility Build a seed follow edge between two profile ids. */
export function follow(follower_id: string, following_id: string, created_at: string): MockFollow {
  return { follower_id, following_id, created_at };
}
