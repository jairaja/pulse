import { PDFDocument } from "pdf-lib";
import { percentages, utcDate, utcTime, number, questionUrl } from "./model.js";

function lines(context, value, width) {
  const result = [];
  let line = "";
  // Grapheme segmentation preserves joined emoji/combining scripts and wraps CJK without spaces.
  const segments = new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(value);
  for (const { segment } of segments) {
    if (
      segment === "\n" ||
      (context.measureText(line + segment).width > width && line)
    ) {
      result.push(line);
      line = segment === "\n" ? "" : segment;
    } else line += segment;
  }
  if (line) result.push(line);
  return result;
}
export async function downloadReport(items) {
  if (!items.length || items.length > 100)
    throw new Error("Choose between 1 and 100 results.");
  await document.fonts.ready;
  const pdf = await PDFDocument.create();
  pdf.setTitle("Pulse — Finalized question results");
  pdf.setSubject("Public aggregate results; no personal voting history");
  pdf.setCreator("Pulse");
  const generated = utcTime(new Date().toISOString());
  for (let index = 0; index < items.length; index++) {
    const item = items[index],
      p = percentages(item),
      canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f6f2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#253f35";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText("PULSE", 90, 120);
    ctx.fillStyle = "#555e57";
    ctx.font = "24px sans-serif";
    ctx.fillText("FINALIZED RESULTS · " + utcDate(item.asked_on), 90, 190);
    ctx.fillStyle = "#172a23";
    ctx.font = "42px sans-serif";
    let y = 290;
    for (const line of lines(ctx, item.question_text, 1060)) {
      if (y > 1050)
        throw new Error(
          "This question is too long for this PDF layout. Use the printable report instead.",
        );
      ctx.fillText(
        line,
        /[\u0600-\u06ff]/.test(line) ? 1150 - ctx.measureText(line).width : 90,
        y,
      );
      y += 62;
    }
    y += 75;
    const barWidth = 1060,
      yesWidth = item.total_votes
        ? (barWidth * item.yes_count) / item.total_votes
        : 0;
    ctx.fillStyle = item.total_votes ? "#d98779" : "#d7d9d1";
    ctx.fillRect(90, y, barWidth, 35);
    ctx.fillStyle = "#3f7254";
    ctx.fillRect(90, y, yesWidth, 35);
    y += 105;
    ctx.fillStyle = "#172a23";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(`YES  ${number(item.yes_count)}  (${p.yes}%)`, 90, y);
    ctx.fillText(`NO   ${number(item.no_count)}  (${p.no}%)`, 90, y + 60);
    ctx.font = "28px sans-serif";
    ctx.fillText(
      `${number(item.total_votes)} votes · ${item.total_votes ? (item.result === "TIE" ? "Tied result" : `${item.result} majority`) : "No votes cast"}`,
      90,
      y + 135,
    );
    ctx.fillStyle = "#555e57";
    ctx.font = "22px sans-serif";
    ctx.fillText(
      "Voting window: 00:00 UTC to the following 00:00 UTC.",
      90,
      1420,
    );
    ctx.fillText(`Finalized: ${utcTime(item.finalized_at)}`, 90, 1460);
    ctx.fillText(`Report generated: ${generated}`, 90, 1500);
    ctx.fillText(
      "These are participating Pulse users, not a representative global sample.",
      90,
      1560,
    );
    ctx.font = "18px sans-serif";
    ctx.fillText(questionUrl(item), 90, 1610, 1060);
    ctx.fillText(`${index + 1} / ${items.length}`, 90, 1670);
    // Browser rasterization supports the same multilingual fallback fonts as the page.
    // The HTML/print report remains the selectable-text alternative.
    const image = await pdf.embedJpg(canvas.toDataURL("image/jpeg", 0.9));
    pdf
      .addPage([595.28, 841.89])
      .drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
    canvas.width = 0;
    canvas.height = 0;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const bytes = await pdf.save();
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    items.length === 1
      ? `pulse-result-${items[0].asked_on}.pdf`
      : `pulse-results-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
