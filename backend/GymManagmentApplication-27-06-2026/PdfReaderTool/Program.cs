using UglyToad.PdfPig;

var pdf = @"C:\Users\Lenovo\OneDrive\Desktop\Project\Gym\GymManagmentApplication\Api-EndPoints.pdf";
using var doc = PdfDocument.Open(pdf);
var sb = new System.Text.StringBuilder();
foreach (var page in doc.GetPages())
    sb.AppendLine(page.Text);
File.WriteAllText(@"C:\Users\Lenovo\OneDrive\Desktop\Project\Gym\pdf_text_clean.txt", sb.ToString());
Console.WriteLine("Done. Total chars: " + sb.Length);
