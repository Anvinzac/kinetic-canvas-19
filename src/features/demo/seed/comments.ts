/**
 * Canonical demo comments including chip-burst stress fixtures.
 *
 * Exports: MOCK_COMMENTS
 * Depends on: seed chip-burst, comment-helpers
 */

import { buildChipBurstComments } from "./chip-burst";
import { comment } from "./comment-helpers";
import { MOCK_ME_ID } from "./profiles";
import type { MockComment } from "./types";


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
