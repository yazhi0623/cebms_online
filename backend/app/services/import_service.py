from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException, status

from app.models.import_task import ImportTask
from app.repositories.import_task_repository import ImportTaskRepository
from app.schemas.import_export import RecordImportCreate
from app.services.audit_service import AuditService


class ImportService:
    """负责导入任务的创建、查询、删除和模板下载。"""

    def __init__(self, import_task_repository: ImportTaskRepository, audit_service: AuditService | None = None) -> None:
        self.import_task_repository = import_task_repository
        self.audit_service = audit_service

    def list_record_imports(self, user_id: int) -> list[ImportTask]:
        """列出当前用户的记录导入任务。"""
        return self.import_task_repository.list_by_user(user_id)

    def create_record_import(self, user_id: int, payload: RecordImportCreate) -> ImportTask:
        """创建导入任务元数据，真正解析由后台任务执行。"""
        task = self.import_task_repository.create(user_id, payload.source_type, payload.file_name)
        if self.audit_service is not None:
            self.audit_service.log(user_id, "create", "import_task", str(task.id), f"source={payload.source_type}")
        return task

    def get_error_report_path(self, task_id: int, user_id: int) -> Path:
        """返回导入失败报告的绝对路径。"""
        task = self.import_task_repository.get_by_id_for_user(task_id, user_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import task not found")
        if not task.error_report_path:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import error report not found")

        path = Path(task.error_report_path)
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import error report not found")
        return path

    def build_record_import_template_zip(self) -> Path:
        """生成示例导入压缩包，方便前端直接提供给用户下载。"""
        template_dir = Path(__file__).resolve().parents[2] / "generated" / "imports"
        template_dir.mkdir(parents=True, exist_ok=True)
        zip_path = template_dir / "record-import-templates.zip"

        json_template = (
            "[\n"
            '  {\n'
            '    "title": "Sample record 1",\n'
            '    "content": "Completed the main task today and stayed steady overall."\n'
            "  },\n"
            '  {\n'
            '    "title": "Sample record 2",\n'
            '    "content": "Reviewed the day in the evening and noted next improvements."\n'
            "  }\n"
            "]\n"
        )
        txt_template = (
            "20250322\n"
            "Completed the main task today and stayed steady overall.\n"
            "Added a short note after an evening walk.\n"
            "\n"
            "250305\n"
            "Reviewed the day in the evening and noted next improvements.\n"
        )
        markdown_template = (
            "# Sample record 1\n\n"
            "Completed the main task today and stayed steady overall.\n\n"
            "## Sample record 2\n\n"
            "Reviewed the day in the evening and noted next improvements.\n"
        )

        with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as archive:
            archive.writestr("records-template.json", json_template.encode("utf-8"))
            archive.writestr("records-template.xlsx", self._build_record_xlsx_template())
            archive.writestr("records-template.txt", txt_template.encode("utf-8"))
            archive.writestr("records-template.md", markdown_template.encode("utf-8"))

        return zip_path

    @staticmethod
    def _build_record_xlsx_template() -> bytes:
        """构造最小可用的 Excel 导入模板。"""
        from io import BytesIO

        from openpyxl import Workbook

        output = BytesIO()
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "records"
        sheet.append(["title", "content"])
        sheet.append(["Sample record 1", "Completed the main task today and stayed steady overall."])
        sheet.append(["Sample record 2", "Reviewed the day in the evening and noted next improvements."])
        workbook.save(output)
        return output.getvalue()

    def delete_record_import(self, task_id: int, user_id: int) -> None:
        """删除导入任务，并清理错误报告文件。"""
        task = self.import_task_repository.get_by_id_for_user(task_id, user_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import task not found")

        report_path = Path(task.error_report_path) if task.error_report_path else None
        self.import_task_repository.delete(task)
        if report_path and report_path.exists() and report_path.is_file():
            report_path.unlink(missing_ok=True)
        if self.audit_service is not None:
            self.audit_service.log(user_id, "delete", "import_task", str(task_id), "delete import task")
