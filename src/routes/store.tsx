import { createFileRoute } from "@tanstack/react-router";
import { StorePage } from "@/features/ecosystem/components/StorePage";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Cửa hàng Chay Lá — anh.chayLá" },
      {
        name: "description",
        content: "Mọi app trong hệ sinh thái Chay Lá, kèm ảnh màn hình và mô tả.",
      },
    ],
  }),
  component: StorePage,
});
