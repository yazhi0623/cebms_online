// 模板对象和记录结构相似，但额外带有默认模板标记。
export type TemplateItem = {
  id: number;
  userId: number;
  title: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
