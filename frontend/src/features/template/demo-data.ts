import type { TemplateItem } from "../../entities/template/types";

// Demo 模式模板用于演示“导入模板到编辑器”的交互链路。
export const demoTemplates: TemplateItem[] = [
  {
    id: -101,
    userId: 0,
    title: "\u9ed8\u8ba4\u65e5\u8bb0\u6a21\u677f",
    content:
      "\u60c5\u7eea\u5206\u503c(1~10)\uff1a\n\u5929\u6c14\uff1a\n\u7761\u7720\uff1a\n\u8fd0\u52a8\uff1a\n\u4e09\u9910\uff1a\n\u505a\u4e86\u4ec0\u4e48\uff1a\n\u9047\u5230\u4e86\u4ec0\u4e48\u95ee\u9898\uff1a\n\u89e3\u51b3\u65b9\u6cd5\uff1a\n\u611f\u6069\uff1a\n\u9700\u8981\u6539\u8fdb\uff1a\n\u5176\u4ed6\uff1a",
    isDefault: true,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  },
  {
    id: -102,
    userId: 0,
    title: "\u591c\u95f4\u590d\u76d8\u6a21\u677f",
    content:
      "\u4eca\u5929\u6700\u503c\u5f97\u8bb0\u5f55\u7684\u4e8b\uff1a\n\u60c5\u7eea\u8d77\u4f0f\uff1a\n\u6211\u7684\u53cd\u5e94\uff1a\n\u53ef\u4ee5\u8c03\u6574\u7684\u5730\u65b9\uff1a\n\u660e\u5929\u7684\u4e00\u4ef6\u5c0f\u4efb\u52a1\uff1a",
    isDefault: false,
    createdAt: "2026-03-02T00:00:00Z",
    updatedAt: "2026-03-02T00:00:00Z",
  },
  {
    id: -103,
    userId: 0,
    title: "\u7b80\u77ed\u5feb\u7167",
    content:
      "\u6b64\u523b\u7684\u60c5\u7eea\uff1a\n\u8eab\u4f53\u72b6\u6001\uff1a\n\u6211\u6b63\u5728\u60f3\u4ec0\u4e48\uff1a\n\u63a5\u4e0b\u6765 30 \u5206\u949f\u6211\u8981\u505a\u4ec0\u4e48\uff1a",
    isDefault: false,
    createdAt: "2026-03-03T00:00:00Z",
    updatedAt: "2026-03-03T00:00:00Z",
  },
];
