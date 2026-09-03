import React from "react";
import "./Salesprint.scss";
import logo1 from "../../Assets/logo/logo.jpeg";
import authorized from "../../Assets/pdf/auth.png";

import width from "../../Assets/pdf/width.png"

import product1 from "../../Assets/pdf/p1.png";
import product2 from "../../Assets/pdf/p2.png";
import product3 from "../../Assets/pdf/p3.png";
import product4 from "../../Assets/pdf/p4.png";
import product5 from "../../Assets/pdf/p5.png";
import product6 from "../../Assets/pdf/p6.png";
import product7 from "../../Assets/pdf/p7.png";
import product8 from "../../Assets/pdf/p8.png";
import product9 from "../../Assets/pdf/p9.png";
import product10 from "../../Assets/pdf/p10.png";
import product11 from "../../Assets/pdf/p11.png";
import product12 from "../../Assets/pdf/p12.png";

import heading1 from "../../Assets/pdf/h1.png";
import heading2 from "../../Assets/pdf/h2.png";
import heading3 from "../../Assets/pdf/h3.png";
import heading6 from "../../Assets/pdf/h4.png";
import heading5 from "../../Assets/pdf/h5.png";
import heading4 from "../../Assets/pdf/h6.png";

const SalesPrint = ({ invoice }) => {
  if (!invoice) return null;

  const {
    invoiceNumber,
    saleDate,
    customerName,
    customerEmail,
    customerPhone,
    customerGstin,
    customerAddress,
    customerState,
    items,
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
    taxBreakdown,
    notes,
    paymentType
  } = invoice;

  // ===== STATIC DATA =====
  const companyName = "Nilkanth digital scale co.";
  const companyAddress = "Dayal Bhuvan lane opp lalcourt rajmahel road vadodara 390001)";
  const companyGst = "24GJOPM0742J1ZY";
  const companyWebsite = "https://nilkanthdigitalscale.in";
  const companyPhone = "+91 8485921934";
  const companyEmail = "nilkanthdigitalscale@gmail.com";

  const bankDetails = {
    bankName: "Central Bank of India",
    branch: "Rajmahal Road",
    accountNo: "5955669435",
    ifscCode: "CBIN0280489"
  };

  const declaration = `We hereby declare that the information provided in this invoice is true and correct to the best of our knowledge and belief. The goods/services mentioned in this invoice are supplied as per the agreed terms and conditions.`;

  const termsAndConditions = `Warranty: Warranty is applicable against manufacturing defects only.
Battery is not covered under warranty under any circumstances.
Stamping/Verification: If required, the weighing machine shall be re-stamped/re-verified after one year as per applicable Government norms.
Once the goods are delivered, they will not be taken back or returned.
To get free repairing service, client needs to bring the product to our workshop.
For repairing, if we visit your site, charges will be taken accordingly.`;

  // ===== Convert numbers to words =====
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
      'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    let integerPart = Math.floor(num);
    let words = '';

    if (integerPart >= 10000000) {
      words += numberToWords(Math.floor(integerPart / 10000000)) + ' Crore ';
      integerPart %= 10000000;
    }

    if (integerPart >= 100000) {
      words += numberToWords(Math.floor(integerPart / 100000)) + ' Lakh ';
      integerPart %= 100000;
    }

    if (integerPart >= 1000) {
      words += numberToWords(Math.floor(integerPart / 1000)) + ' Thousand ';
      integerPart %= 1000;
    }

    if (integerPart >= 100) {
      words += numberToWords(Math.floor(integerPart / 100)) + ' Hundred ';
      integerPart %= 100;
    }

    if (integerPart > 0) {
      if (words !== '') words += ' ';
      if (integerPart < 20) {
        words += ones[integerPart];
      } else {
        words += tens[Math.floor(integerPart / 10)];
        if (integerPart % 10 > 0) {
          words += ' ' + ones[integerPart % 10];
        }
      }
    }

    const decimalPart = Math.round((num - Math.floor(num)) * 100);
    if (decimalPart > 0) {
      if (words !== '') words += ' and ';
      if (decimalPart < 20) {
        words += ones[decimalPart] + ' Paise';
      } else {
        words += tens[Math.floor(decimalPart / 10)];
        if (decimalPart % 10 > 0) {
          words += ' ' + ones[decimalPart % 10] + ' Paise';
        }
      }
    }

    return words || 'Zero Only';
  };

  // ===== Calculate item discounted total =====
  const calculateItemDiscountedTotal = (item) => {
    const quantity = item.quantity || 1;
    const price = item.unitPrice || 0;
    const discountPercentage = item.discountPercent || 0;
    const itemTotal = price * quantity;
    const discountAmount = itemTotal * (discountPercentage / 100);
    return itemTotal - discountAmount;
  };

  // ===== Safe number formatting =====
  const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return "₹0.00";
    return `₹${Number(value).toFixed(2)}`;
  };

  const formatNumber = (value) => {
    if (value === undefined || value === null || isNaN(value)) return "0.00";
    return Number(value).toFixed(2);
  };

  // ===== Format date =====
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ===== Helper: Check if value exists =====
  const hasValue = (val) => {
    return val && val !== 'N/A' && val !== '' && val !== null && val !== undefined;
  };

  // ===== Tax split flags for calculation section =====
  const hasCgstSgst = taxBreakdown && (taxBreakdown.cgst > 0 || taxBreakdown.sgst > 0);
  const hasIgst = taxBreakdown && !hasCgstSgst && taxBreakdown.igst > 0;
  const hasPlainTax = !hasCgstSgst && !hasIgst && totalTax > 0;

  // ===== Product showcase data (shared across pages 2-4) =====
  // Real product images (product1-product12) used for gallery grid,
  // hero small-grid and the polaroid page.
  const productImages = [
    product1, product2, product3, product4, product5, product6,
    product7, product8, product9, product10, product11, product12
  ];

  const productCaptions = productImages.map((_, index) => {
    if (items && items.length > 0) {
      const item = items[index % items.length];
      return item?.productName || `Product ${index + 1}`;
    }
    return `Product ${index + 1}`;
  });

  // Wide hero image (separate from the 12 products) used only on page 4
  const heroImage = width;
  const heroCaption = (items && items[0]?.productName) || "Featured Product";

  return (
    <div id="sales-pdf">
      <div className="invoice-container">

        {/* ===== HEADER (Logo + Heading Image Clusters) ===== */}
        <div className="invoice-header">
          <div className="header-images header-images-left">
            <img src={heading1} alt="" className="header-img img-pos-1" />
            <img src={heading2} alt="" className="header-img img-pos-2" />
            <img src={heading3} alt="" className="header-img img-pos-3" />
          </div>

          <div className="invoice-logo">
            <img src={logo1} alt="Company Logo" />
          </div>

          <div className="header-images header-images-right">
            <img src={heading4} alt="" className="header-img img-pos-4" />
            <img src={heading5} alt="" className="header-img img-pos-5" />
            <img src={heading6} alt="" className="header-img img-pos-6" />
          </div>
        </div>

        <div className="invoice-divider"></div>

        {/* ===== BILLING INFO (LEFT 50%) & OWNER INFO (RIGHT 50%) - SAME ROW ===== */}
        <div className="info-section">
          <div className="customer-info">
            <h3 className="info-heading">Billing Info</h3>
            <div className="info-row">
              <span className="info-label">Invoice No:</span>
              <span className="info-value">{invoiceNumber || "N/A"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Date:</span>
              <span className="info-value">{formatDate(saleDate)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Customer:</span>
              <span className="info-value">{customerName || "N/A"}</span>
            </div>
            {hasValue(customerAddress) && (
              <div className="info-row">
                <span className="info-label">Address:</span>
                <span className="info-value">{customerAddress}</span>
              </div>
            )}
            {hasValue(customerPhone) && (
              <div className="info-row">
                <span className="info-label">Phone:</span>
                <span className="info-value">{customerPhone}</span>
              </div>
            )}
            {hasValue(customerEmail) && (
              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">{customerEmail}</span>
              </div>
            )}
            {hasValue(customerGstin) && (
              <div className="info-row">
                <span className="info-label">GSTIN:</span>
                <span className="info-value">{customerGstin}</span>
              </div>
            )}
          </div>

          <div className="owner-info">
            <h3 className="info-heading">Owner Info</h3>
            <div className="owner-name">{companyName}</div>
            <div className="owner-email">{companyEmail}</div>
            <div className="owner-phone">{companyPhone}</div>
            <div className="owner-address">{companyAddress}</div>
            <div className="owner-gst">GST: {companyGst}</div>
            <div className="owner-website-row">
              <span className="owner-website-label">Website: </span>
              <a
                href={companyWebsite}
                target="_blank"
                rel="noreferrer"
                className="owner-website-link"
              >
                {companyWebsite}
              </a>
            </div>
          </div>
        </div>

        {/* ===== ITEMS TABLE (Heading Left Aligned) ===== */}
        <div className="items-section">
          <h3>ITEMS DETAILS</h3>
          <table className="items-table">
            <thead>
              <tr>
                <th>SR NO</th>
                <th>PRODUCT NAME</th>
                <th>HSN CODE</th>
                <th>QTY</th>
                <th>PRICE</th>
                <th>DISC %</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items && items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.productName || "N/A"}</td>
                  <td>{item.hsnCode || "N/A"}</td>
                  <td>{item.quantity || 1}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatNumber(item.discountPercent)}</td>
                  <td>{formatCurrency(calculateItemDiscountedTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== TOTALS ROW: BANK + AMOUNT IN WORDS (LEFT) & CALCULATIONS (RIGHT) ===== */}
        <div className="totals-row">
          <div className="totals-left">
            {/* ===== BANK DETAILS ===== */}
            <div className="bank-details">
              <div className="bank-row">
                <span className="bank-label">Bank Name:</span>
                <span className="bank-value">{bankDetails.bankName}</span>
              </div>
              <div className="bank-row">
                <span className="bank-label">Branch:</span>
                <span className="bank-value">{bankDetails.branch}</span>
              </div>
              <div className="bank-row">
                <span className="bank-label">A/c No.:</span>
                <span className="bank-value">{bankDetails.accountNo}</span>
              </div>
              <div className="bank-row">
                <span className="bank-label">IFSC Code:</span>
                <span className="bank-value">{bankDetails.ifscCode}</span>
              </div>
            </div>

            {/* ===== AMOUNT IN WORDS ===== */}
            <div className="amount-in-words">
              <p><strong>Amount in Words:</strong> {numberToWords(grandTotal)} Only</p>
            </div>
          </div>

          <div className="totals-right">
            {/* ===== CALCULATIONS ===== */}
            <div className="calculation-section">
              <div className="calculation-box">
                <div className="calc-row">
                  <span className="calc-label">Subtotal:</span>
                  <span className="calc-value">{formatCurrency(subtotal)}</span>
                </div>

                {totalDiscount > 0 && (
                  <div className="calc-row">
                    <span className="calc-label">Discount:</span>
                    <span className="calc-value">{formatCurrency(totalDiscount)}</span>
                  </div>
                )}

                <div className="calc-row">
                  <span className="calc-label">Taxable Amount:</span>
                  <span className="calc-value">{formatCurrency(subtotal - totalDiscount)}</span>
                </div>

                {hasCgstSgst && (
                  <>
                    <div className="calc-row">
                      <span className="calc-label">CGST:</span>
                      <span className="calc-value">{formatCurrency(taxBreakdown.cgst)}</span>
                    </div>
                    <div className="calc-row">
                      <span className="calc-label">SGST:</span>
                      <span className="calc-value">{formatCurrency(taxBreakdown.sgst)}</span>
                    </div>
                  </>
                )}

                {hasIgst && (
                  <div className="calc-row">
                    <span className="calc-label">IGST:</span>
                    <span className="calc-value">{formatCurrency(taxBreakdown.igst)}</span>
                  </div>
                )}

                {hasPlainTax && (
                  <div className="calc-row">
                    <span className="calc-label">Tax (GST):</span>
                    <span className="calc-value">{formatCurrency(totalTax)}</span>
                  </div>
                )}

                <div className="calc-row grand-total">
                  <span className="calc-label">Grand Total:</span>
                  <span className="calc-value">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== DECLARATION (LEFT) & TERMS (RIGHT) - SAME ROW ===== */}
        <div className="declaration-terms-section">
          <div className="declaration-section">
            <h3>DECLARATION</h3>
            <p>{declaration}</p>
          </div>
          <div className="terms-section">
            <h3>TERMS &amp; CONDITIONS</h3>
            <ul>
              {termsAndConditions.split('\n').map((term, index) => (
                term.trim() && <li key={index}>{term.trim()}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ===== FOOTER: JURISDICTION (LEFT) & SIGNATURE (RIGHT) - SAME ROW ===== */}
        <div className="invoice-footer">
          <div className="footer-left">
            <p>Subject To Vadodara Jurisdiction</p>
          </div>
          <div className="footer-right">
            <div className="signature-container">
              <img src={authorized} alt="Authorized Signature" className="signature-image" />
              <p className="signature-label">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* NOTE: "Developed by Techorses" is NOT rendered here anymore.
            It is added on every PDF page (bottom-right) directly via jsPDF
            in the generatePDF() function inside Sales.jsx using pdf.text() 
            looped over all pages — since html2canvas only captures this 
            HTML once and can't repeat it per page. */}

      </div>

      {/* ==========================================================
          PAGE 2: PRODUCT GALLERY (plain 3-column captioned grid)
      ========================================================== */}
      <div className="product-gallery-page">
        <div className="gallery-banner">
          <h2>OUR PRODUCT RANGE</h2>
          <p>A glimpse of the products &amp; equipment we deal in</p>
        </div>

        <div className="gallery-grid">
          {productImages.map((src, index) => (
            <div className="gallery-card" key={index}>
              <div className="gallery-img-wrap">
                <img src={src} alt={productCaptions[index]} />
              </div>
              <p className="gallery-caption">{productCaptions[index]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ==========================================================
          PAGE 3: BIG HERO (wide image) + SMALL GRID (all 12 products)
      ========================================================== */}
      <div className="hero-grid-page">
        <div className="gallery-banner">
          <h2>FEATURED PRODUCTS</h2>
          <p>Highlighting our best-selling range</p>
        </div>

        <div className="hero-image-wrap">
          <img src={heroImage} alt={heroCaption} />
          <p className="hero-caption">{heroCaption}</p>
        </div>

        <div className="hero-small-grid">
          {productImages.map((src, index) => (
            <div className="small-card" key={index}>
              <img src={src} alt={productCaptions[index]} />
              <p>{productCaptions[index]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ==========================================================
          PAGE 4: POLAROID / SCATTERED CARD STYLE
      ========================================================== */}
      <div className="polaroid-page">
        <div className="gallery-banner">
          <h2>PRODUCT GALLERY</h2>
          <p>A closer look at what we offer</p>
        </div>

        <div className="polaroid-grid">
          {productImages.map((src, index) => (
            <div className={`polaroid-card polaroid-pos-${(index % 6) + 1}`} key={index}>
              <div className="polaroid-img-wrap">
                <img src={src} alt={productCaptions[index]} />
              </div>
              <p className="polaroid-caption">{productCaptions[index]}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default SalesPrint;