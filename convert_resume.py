import os
from xhtml2pdf import pisa

def convert_html_to_pdf(source_html_path, output_pdf_path):
    print(f"Reading HTML from: {source_html_path}")
    with open(source_html_path, "r", encoding="utf-8") as source_file:
        html_content = source_file.read()

    print(f"Writing PDF to: {output_pdf_path}")
    with open(output_pdf_path, "w+b") as result_file:
        # Convert HTML to PDF
        pisa_status = pisa.CreatePDF(
            html_content,
            dest=result_file
        )
    
    if pisa_status.err:
        print("Error converting HTML to PDF!")
    else:
        print("PDF generated successfully!")

if __name__ == "__main__":
    source = "Amol_Shukla_Resume.html"
    output = "Amol_Shukla_Resume.pdf"
    convert_html_to_pdf(source, output)
