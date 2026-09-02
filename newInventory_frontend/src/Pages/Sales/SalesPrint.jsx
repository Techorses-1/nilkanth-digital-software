import React from "react";
import "./SalesPrint.scss";
import logo1 from "../../Assets/logo/logo.jpeg";
import authorized from "../../Assets/logo/auth.png";

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
    paymentType,
    internalInvoiceNumber
  } = invoice;

  // ===== STATIC DATA =====
  const companyName = "TECHORSES";
  const companyAddress = "B-224, Samanvay Silicon, Opp Kalyan Hotel, Dairy Den Circle, Sayajigunj, Vadodara, 390020 (Gujarat, India)";
  const companyGst = "24AAICS9235N...";

  const bankDetails = {
    bankName: "Central Bank of India",
    branch: "Rajmahal Road",
    accountNo: "595669435",
    ifscCode: "CBIN0280489"
  };

  const declaration = `We hereby declare that the information provided in this invoice is true and correct to the best of our knowledge and belief. The goods/services mentioned in this invoice are supplied as per the agreed terms and conditions.`;

  const termsAndConditions = `Warranty: Warranty is applicable against manufacturing defects only.
Battery: Battery is not covered under warranty under any circumstances.
Re-Stamping / Re-Verification: If required, the weighing machine shall be re-stamped/re-verified after one year as per applicable Government norms.
Goods Once Delivered: Once the goods are delivered, they will not be taken back or returned.`;

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

  // ===== Get tax breakdown =====
  const getTaxDisplay = () => {
    if (!taxBreakdown) {
      return { label: 'GST', amount: totalTax || 0 };
    }
    if (taxBreakdown.cgst > 0 || taxBreakdown.sgst > 0) {
      return {
        label: 'CGST/SGST',
        cgst: taxBreakdown.cgst || 0,
        sgst: taxBreakdown.sgst || 0
      };
    } else if (taxBreakdown.igst > 0) {
      return {
        label: 'IGST',
        amount: taxBreakdown.igst || totalTax || 0
      };
    } else if (taxBreakdown.gst > 0) {
      return {
        label: 'GST',
        amount: taxBreakdown.gst || totalTax || 0
      };
    }
    return { label: 'GST', amount: totalTax || 0 };
  };

  const taxDisplay = getTaxDisplay();

  // ===== Helper: Check if value exists =====
  const hasValue = (val) => {
    return val && val !== 'N/A' && val !== '' && val !== null && val !== undefined;
  };

  return (
    <div id="sales-pdf">
      <div className="invoice-container">

        {/* ===== HEADER ===== */}
        <div className="invoice-header">
          <div className="invoice-logo">
            <img src={logo1} alt="Company Logo" />
          </div>
        </div>

        <div className="invoice-divider"></div>

        {/* ===== CUSTOMER INFO (LEFT) & OWNER INFO (RIGHT) ===== */}
        <div className="info-section">
          <div className="customer-info">
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
            {hasValue(internalInvoiceNumber) && (
              <div className="info-row">
                <span className="info-label">Internal No:</span>
                <span className="info-value">{internalInvoiceNumber}</span>
              </div>
            )}
          </div>

          <div className="owner-info">
            <div className="owner-name">{companyName}</div>
            <div className="owner-address">{companyAddress}</div>
            <div className="owner-gst">GST: {companyGst}</div>
          </div>
        </div>

        {/* ===== ITEMS TABLE ===== */}
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

        {/* ===== CALCULATIONS (Right Side) ===== */}
        <div className="calculation-section">
          <div className="calculation-box">
            <div className="calc-row">
              <span className="calc-label">Subtotal:</span>
              <span className="calc-value">{formatCurrency(subtotal)}</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">Discount:</span>
              <span className="calc-value">{formatCurrency(totalDiscount)}</span>
            </div>
            <div className="calc-row">
              <span className="calc-label">Taxable Amount:</span>
              <span className="calc-value">{formatCurrency(subtotal - totalDiscount)}</span>
            </div>
            {totalTax > 0 && (
              <div className="calc-row">
                <span className="calc-label">Tax ({taxDisplay.label}):</span>
                <span className="calc-value">{formatCurrency(totalTax)}</span>
              </div>
            )}
            <div className="calc-row grand-total">
              <span className="calc-label">Grand Total:</span>
              <span className="calc-value">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* ===== AMOUNT IN WORDS ===== */}
        <div className="amount-in-words">
          <p><strong>Amount in Words:</strong> {numberToWords(grandTotal)} Only</p>
        </div>

        {/* ===== BANK DETAILS (Column) ===== */}
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

        {/* ===== DECLARATION & TERMS ===== */}
        <div className="declaration-terms-section">
          <div className="declaration-section">
            <h3>DECLARATION</h3>
            <p>{declaration}</p>
          </div>
          <div className="terms-section">
            <h3>TERMS & CONDITIONS</h3>
            <ul>
              {termsAndConditions.split('\n').map((term, index) => (
                term.trim() && <li key={index}>{term.trim()}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
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

        {/* ===== DEVELOPER NOTE (Bottom Right of each page) ===== */}
        <div className="developer-note">
          Developed by Techorses
        </div>

      </div>
    </div>
  );
};

export default SalesPrint;