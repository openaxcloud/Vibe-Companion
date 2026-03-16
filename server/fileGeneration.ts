import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";

export interface FileSection {
  type: "heading" | "paragraph" | "table" | "list";
  content?: string;
  level?: number;
  headers?: string[];
  rows?: string[][];
  items?: string[];
}

export interface FileGenerationInput {
  format: "pdf" | "docx" | "xlsx" | "csv" | "pptx";
  filename: string;
  title?: string;
  sections: FileSection[];
}

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
};

export function getMimeType(format: string): string {
  return MIME_TYPES[format] || "application/octet-stream";
}

export function getFileExtension(format: string): string {
  return format;
}

export async function generateFile(input: FileGenerationInput): Promise<Buffer> {
  switch (input.format) {
    case "pdf":
      return generatePDF(input);
    case "docx":
      return generateDOCX(input);
    case "xlsx":
      return generateXLSX(input);
    case "pptx":
      return generatePPTX(input);
    case "csv":
      return generateCSV(input);
    default:
      throw new Error(`Unsupported format: ${input.format}`);
  }
}

async function generatePDF(input: FileGenerationInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (input.title) {
      doc.fontSize(24).font("Helvetica-Bold").text(input.title, { align: "center" });
      doc.moveDown(1.5);
    }

    for (const section of input.sections) {
      switch (section.type) {
        case "heading": {
          const fontSize = section.level === 1 ? 20 : section.level === 2 ? 16 : 13;
          doc.fontSize(fontSize).font("Helvetica-Bold").text(section.content || "", { align: "left" });
          doc.moveDown(0.5);
          break;
        }
        case "paragraph": {
          doc.fontSize(11).font("Helvetica").text(section.content || "", { align: "left", lineGap: 4 });
          doc.moveDown(0.8);
          break;
        }
        case "list": {
          if (section.items) {
            for (const item of section.items) {
              doc.fontSize(11).font("Helvetica").text(`  •  ${item}`, { indent: 10, lineGap: 3 });
            }
            doc.moveDown(0.5);
          }
          break;
        }
        case "table": {
          if (section.headers || section.rows) {
            const allRows = [];
            if (section.headers) allRows.push(section.headers);
            if (section.rows) allRows.push(...section.rows);
            if (allRows.length > 0) {
              const colCount = Math.max(...allRows.map(r => r.length));
              const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
              const colWidth = tableWidth / colCount;
              const rowHeight = 22;
              const startX = doc.page.margins.left;

              for (let ri = 0; ri < allRows.length; ri++) {
                const row = allRows[ri];
                const y = doc.y;
                const isHeader = ri === 0 && section.headers;

                if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                  doc.addPage();
                }

                const currentY = doc.y;

                if (isHeader) {
                  doc.rect(startX, currentY, tableWidth, rowHeight).fill("#f0f0f0").stroke("#cccccc");
                } else {
                  doc.rect(startX, currentY, tableWidth, rowHeight).stroke("#cccccc");
                }

                for (let ci = 0; ci < colCount; ci++) {
                  const cellText = (row[ci] || "").toString();
                  const cellX = startX + ci * colWidth + 4;
                  doc.fillColor("#000000")
                    .fontSize(isHeader ? 10 : 9)
                    .font(isHeader ? "Helvetica-Bold" : "Helvetica")
                    .text(cellText, cellX, currentY + 6, { width: colWidth - 8, height: rowHeight - 4, lineBreak: false });
                }

                doc.y = currentY + rowHeight;
              }

              doc.moveDown(0.8);
            }
          }
          break;
        }
      }
    }

    doc.end();
  });
}

async function generateDOCX(input: FileGenerationInput): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  if (input.title) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: input.title, bold: true, size: 48, font: "Calibri" })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  for (const section of input.sections) {
    switch (section.type) {
      case "heading": {
        const headingLevel = section.level === 1 ? HeadingLevel.HEADING_1 : section.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: section.content || "", bold: true, font: "Calibri" })],
            heading: headingLevel,
            spacing: { before: 240, after: 120 },
          })
        );
        break;
      }
      case "paragraph": {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: section.content || "", size: 22, font: "Calibri" })],
            spacing: { after: 200 },
          })
        );
        break;
      }
      case "list": {
        if (section.items) {
          for (const item of section.items) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: item, size: 22, font: "Calibri" })],
                bullet: { level: 0 },
                spacing: { after: 80 },
              })
            );
          }
        }
        break;
      }
      case "table": {
        if (section.headers || section.rows) {
          const tableRows: TableRow[] = [];
          if (section.headers) {
            tableRows.push(
              new TableRow({
                children: section.headers.map(h =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: "Calibri" })] })],
                    width: { size: 100 / section.headers!.length, type: WidthType.PERCENTAGE },
                    shading: { fill: "D9E2F3" },
                  })
                ),
              })
            );
          }
          if (section.rows) {
            for (const row of section.rows) {
              const colCount = section.headers?.length || row.length;
              tableRows.push(
                new TableRow({
                  children: row.map(cell =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cell || "", size: 20, font: "Calibri" })] })],
                      width: { size: 100 / colCount, type: WidthType.PERCENTAGE },
                    })
                  ),
                })
              );
            }
          }
          if (tableRows.length > 0) {
            children.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
            children.push(new Paragraph({ spacing: { after: 200 } }));
          }
        }
        break;
      }
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBuffer(doc);
}

async function generateXLSX(input: FileGenerationInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "E-Code IDE";
  workbook.created = new Date();

  const sheetName = (input.title || "Sheet1").slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);

  let currentRow = 1;

  if (input.title) {
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = input.title;
    titleRow.getCell(1).font = { bold: true, size: 16 };
    currentRow += 2;
  }

  for (const section of input.sections) {
    switch (section.type) {
      case "heading": {
        const headingRow = worksheet.getRow(currentRow);
        headingRow.getCell(1).value = section.content || "";
        headingRow.getCell(1).font = { bold: true, size: section.level === 1 ? 14 : section.level === 2 ? 12 : 11 };
        currentRow += 1;
        break;
      }
      case "paragraph": {
        const textRow = worksheet.getRow(currentRow);
        textRow.getCell(1).value = section.content || "";
        textRow.getCell(1).alignment = { wrapText: true };
        currentRow += 1;
        break;
      }
      case "list": {
        if (section.items) {
          for (const item of section.items) {
            const listRow = worksheet.getRow(currentRow);
            listRow.getCell(1).value = `• ${item}`;
            currentRow += 1;
          }
        }
        currentRow += 1;
        break;
      }
      case "table": {
        if (section.headers) {
          const headerRow = worksheet.getRow(currentRow);
          section.headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
            cell.border = {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" },
            };
          });
          currentRow += 1;
        }
        if (section.rows) {
          for (const row of section.rows) {
            const dataRow = worksheet.getRow(currentRow);
            row.forEach((cell, i) => {
              const excelCell = dataRow.getCell(i + 1);
              const numVal = Number(cell);
              excelCell.value = !isNaN(numVal) && cell.trim() !== "" ? numVal : cell;
              excelCell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              };
            });
            currentRow += 1;
          }
        }
        currentRow += 1;

        const colCount = Math.max(section.headers?.length || 0, ...(section.rows || []).map(r => r.length));
        for (let i = 1; i <= colCount; i++) {
          const col = worksheet.getColumn(i);
          col.width = 18;
        }
        break;
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

async function generateCSV(input: FileGenerationInput): Promise<Buffer> {
  const lines: string[] = [];

  for (const section of input.sections) {
    if (section.type === "table") {
      if (section.headers) {
        lines.push(section.headers.map(escapeCSVField).join(","));
      }
      if (section.rows) {
        for (const row of section.rows) {
          lines.push(row.map(escapeCSVField).join(","));
        }
      }
    } else if (section.type === "heading" || section.type === "paragraph") {
      if (section.content) {
        lines.push(escapeCSVField(section.content));
      }
    } else if (section.type === "list" && section.items) {
      for (const item of section.items) {
        lines.push(escapeCSVField(item));
      }
    }
  }

  return Buffer.from(lines.join("\n"), "utf-8");
}

async function generatePPTX(input: FileGenerationInput): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "E-Code IDE";
  pptx.title = input.title || "Presentation";

  if (input.title) {
    const titleSlide = pptx.addSlide();
    titleSlide.addText(input.title, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 2,
      fontSize: 36,
      bold: true,
      align: "center",
      valign: "middle",
      color: "1F2937",
      fontFace: "Calibri",
    });
  }

  let currentSlide = input.title ? null : pptx.addSlide();
  let yPos = 0.5;
  const maxY = 6.5;

  const ensureSlide = () => {
    if (!currentSlide || yPos > maxY) {
      currentSlide = pptx.addSlide();
      yPos = 0.5;
    }
    return currentSlide;
  };

  for (const section of input.sections) {
    switch (section.type) {
      case "heading": {
        const slide = ensureSlide();
        const fontSize = section.level === 1 ? 28 : section.level === 2 ? 22 : 18;
        slide.addText(section.content || "", {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 0.6,
          fontSize,
          bold: true,
          color: "1F2937",
          fontFace: "Calibri",
        });
        yPos += 0.8;
        break;
      }
      case "paragraph": {
        const slide = ensureSlide();
        slide.addText(section.content || "", {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 1,
          fontSize: 14,
          color: "374151",
          fontFace: "Calibri",
          valign: "top",
          wrap: true,
        });
        yPos += 1.2;
        break;
      }
      case "list": {
        if (section.items) {
          const slide = ensureSlide();
          const listText = section.items.map(item => ({
            text: item,
            options: { bullet: { type: "bullet" as const }, fontSize: 14, color: "374151", fontFace: "Calibri" },
          }));
          slide.addText(listText, {
            x: 0.5,
            y: yPos,
            w: 9,
            h: Math.min(section.items.length * 0.4, maxY - yPos),
            valign: "top",
          });
          yPos += section.items.length * 0.4 + 0.3;
        }
        break;
      }
      case "table": {
        if (section.headers || section.rows) {
          const slide = ensureSlide();
          const tableRows: PptxGenJS.TableRow[] = [];
          if (section.headers) {
            tableRows.push(section.headers.map(h => ({
              text: h,
              options: { bold: true, fontSize: 11, color: "FFFFFF", fill: { color: "4472C4" }, fontFace: "Calibri" },
            })));
          }
          if (section.rows) {
            for (let ri = 0; ri < section.rows.length; ri++) {
              tableRows.push(section.rows[ri].map(cell => ({
                text: cell || "",
                options: {
                  fontSize: 10,
                  color: "374151",
                  fill: { color: ri % 2 === 0 ? "F3F4F6" : "FFFFFF" },
                  fontFace: "Calibri",
                },
              })));
            }
          }
          if (tableRows.length > 0) {
            slide.addTable(tableRows, {
              x: 0.5,
              y: yPos,
              w: 9,
              border: { type: "solid", pt: 0.5, color: "D1D5DB" },
              colW: Array(Math.max(...tableRows.map(r => r.length))).fill(9 / Math.max(...tableRows.map(r => r.length))),
            });
            yPos += tableRows.length * 0.4 + 0.5;
          }
        }
        break;
      }
    }
  }

  const arrayBuffer = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
