// 单条记录在前端的标准形态，页面和 API 都围绕这个结构读写。
export type RecordItem = {
  id: number;
  userId: number;
  templateId: number | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};
