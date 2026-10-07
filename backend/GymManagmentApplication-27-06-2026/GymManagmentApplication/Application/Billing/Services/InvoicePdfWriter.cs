using System.Globalization;
using System.Text;

namespace GymManagmentApplication.Application.Billing.Services;

/// <summary>
/// Dependency-free writer for a single-page, text-only PDF (PDF 1.4, built-in Helvetica).
/// Enough for a printable invoice without pulling in a PDF library.
/// </summary>
public static class InvoicePdfWriter
{
    public record Line(string Text, int Size = 11, bool Bold = false);

    public static byte[] Write(IReadOnlyList<Line> lines)
    {
        // Content stream: one text line per entry, top-down from y=790 on an A4 page.
        var content = new StringBuilder();
        var y = 790;
        foreach (var line in lines)
        {
            var font = line.Bold ? "/F2" : "/F1";
            content.Append(CultureInfo.InvariantCulture,
                $"BT {font} {line.Size} Tf 56 {y} Td ({Escape(line.Text)}) Tj ET\n");
            y -= line.Size + 9;
            if (y < 50) break; // single page
        }
        var stream = Encoding.Latin1.GetBytes(content.ToString());

        var objects = new List<byte[]>
        {
            Ascii("<< /Type /Catalog /Pages 2 0 R >>"),
            Ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
            Ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
                  "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>"),
            Concat(Ascii($"<< /Length {stream.Length} >>\nstream\n"), stream, Ascii("endstream")),
            Ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
            Ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
        };

        using var ms = new MemoryStream();
        void Put(byte[] b) => ms.Write(b, 0, b.Length);

        Put(Ascii("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n"));
        var offsets = new List<long>();
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(ms.Position);
            Put(Ascii($"{i + 1} 0 obj\n"));
            Put(objects[i]);
            Put(Ascii("\nendobj\n"));
        }

        var xref = ms.Position;
        var sb = new StringBuilder();
        sb.Append(CultureInfo.InvariantCulture, $"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append(CultureInfo.InvariantCulture, $"{o:D10} 00000 n \n");
        sb.Append(CultureInfo.InvariantCulture,
            $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        Put(Ascii(sb.ToString()));
        return ms.ToArray();
    }

    private static string Escape(string s) =>
        s.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)").Replace("\r", " ").Replace("\n", " ");

    private static byte[] Ascii(string s) => Encoding.Latin1.GetBytes(s);

    private static byte[] Concat(params byte[][] parts) => parts.SelectMany(p => p).ToArray();
}
