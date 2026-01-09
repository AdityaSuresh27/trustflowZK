# Frontend Input Validation Improvements

## Overview
Comprehensive input validation has been implemented across all ZKPulse frontend forms to ensure data integrity and prevent malformed submissions. The validation includes both client-side checks and user-friendly error messaging.

## Validation Functions

### 1. validateCustomerId(id)
**Location:** `frontend/src/App.js`

**Rules:**
- Required field
- Minimum 3 characters
- Maximum 20 characters
- Alphanumeric with hyphens and underscores only (no spaces, special chars)

**Error Messages:**
- "Customer ID is required"
- "Customer ID must be at least 3 characters"
- "Customer ID cannot exceed 20 characters"
- "Customer ID can only contain letters, numbers, hyphens, and underscores"

**Used in:**
- PIN Registration screen
- Sign-In screen

---

### 2. validatePin(pin)
**Location:** `frontend/src/App.js`

**Rules:**
- Required field
- Must contain only digits (0-9)
- Minimum 4 digits
- Maximum 6 digits

**Error Messages:**
- "PIN is required"
- "PIN must contain only digits"
- "PIN must be at least 4 digits"
- "PIN cannot exceed 6 digits"

**Used in:**
- PIN Registration screen
- PIN Entry for Payment screen

---

### 3. validateAmount(amount)
**Location:** `frontend/src/App.js`, `frontend/src/MerchantPageEnhanced.js`, `frontend/src/MerchantPage.js`

**Rules:**
- Required field
- Must be a valid number
- Must be positive (> 0)
- Maximum ₹100,000
- Maximum 2 decimal places

**Error Messages:**
- "Amount is required"
- "Amount must be a valid number"
- "Amount must be greater than 0"
- "Amount cannot exceed ₹100,000"
- "Amount can have at most 2 decimal places"

**Used in:**
- Payment Amount Entry screen
- Merchant QR Code Generation (MerchantPageEnhanced.js)
- Merchant QR Code Generation (MerchantPage.js)

---

### 4. validateMerchantId(id)
**Location:** `frontend/src/MerchantPageEnhanced.js`, `frontend/src/MerchantPage.js`

**Rules:**
- Required field
- Minimum 2 characters
- Maximum 20 characters
- Alphanumeric with hyphens and underscores only

**Error Messages:**
- "Merchant ID is required"
- "Merchant ID must be at least 2 characters"
- "Merchant ID cannot exceed 20 characters"
- "Merchant ID can only contain letters, numbers, hyphens, and underscores"

**Used in:**
- Merchant QR Code Generation (both merchant pages)

---

### 5. validateChatMessage(message)
**Location:** `frontend/src/MerchantPageEnhanced.js`

**Rules:**
- Required field (cannot be empty or whitespace only)
- Maximum 500 characters

**Error Messages:**
- "Message cannot be empty"
- "Message cannot exceed 500 characters"

**Used in:**
- Chat AI Assistant input

---

## Validation Triggers

### Real-Time Feedback (As User Types)
Each input field provides **live validation** as the user types:
- **Visual indicators:** Red border on invalid input
- **Helper text:** Shows format requirements in light gray
- **Error messages:** Red warning text with ⚠️ icon showing specific validation failure

**Implementation:**
```javascript
onChange={(e) => {
  setFieldValue(e.target.value);
  if (e.target.value) {
    const validation = validateField(e.target.value);
    setValidationErrors({
      ...validationErrors,
      fieldName: validation.valid ? null : validation.error
    });
  }
}}
```

### Form Submission Validation (Blocking)
When user attempts to submit a form:
- **Prevents submission** if validation fails
- **Shows error message** in alert box
- **Clears validation errors** on successful submission

**Implementation:**
```javascript
const handleFormSubmit = async () => {
  const validation = validateField(fieldValue);
  if (!validation.valid) {
    setError(validation.error);
    return; // Block submission
  }
  // Proceed with form submission...
};
```

---

## HTML Input Constraints

All input fields have HTML5 constraints to further restrict user input:

### Text Inputs (Customer ID, Merchant ID)
```html
<input 
  type="text"
  maxLength="20"
  style={{ borderColor: validationErrors.fieldName ? '#ff6b6b' : 'inherit' }}
/>
```

### Number Inputs (Amount)
```html
<input 
  type="number"
  min="0"
  max="100000"
  step="0.01"
  style={{ borderColor: validationErrors.amount ? '#ff6b6b' : 'inherit' }}
/>
```

### Password Inputs (PIN)
```html
<input 
  type="password"
  maxLength="6"
  inputMode="numeric"
/>
```

### Text Areas (Chat Messages)
```html
<input 
  type="text"
  maxLength="500"
  disabled={loading || isListening}
/>
```

---

## Forms Enhanced

### 1. Customer Forms (App.js)

#### PIN Registration
- **Customer ID validation:** Real-time + submission
- **PIN validation:** Real-time + submission
- **Helper text:** Format requirements for each field
- **Error display:** Inline error messages with red borders

#### Sign-In
- **Customer ID validation:** Real-time + submission
- **PIN validation:** Real-time + submission
- **Same constraints** as PIN Registration

#### Amount Entry
- **Amount validation:** Real-time + submission
- **Helper text:** Shows ₹100,000 limit and decimal rules
- **Number input:** Restricted to numeric/decimal via inputMode

#### PIN Submission (Payment)
- **PIN validation:** Real-time + submission
- **Character restrictions:** Numeric only via inputMode

---

### 2. Merchant Forms (MerchantPageEnhanced.js)

#### QR Code Generation
- **Merchant ID validation:** Real-time + submission
- **Amount validation:** Real-time + submission
- **Visual feedback:** Red borders for invalid fields
- **Helper text:** Requirements for both fields

#### Chat AI Assistant
- **Message validation:** Real-time check for length
- **Character limit:** 500 characters max with counter
- **Prevents submission:** If message is empty or too long
- **Visual feedback:** Disables send button while loading

---

### 3. Merchant Forms (MerchantPage.js)

#### QR Code Generation
- **Merchant ID validation:** Real-time + submission
- **Amount validation:** Real-time + submission
- **Same enhancements** as MerchantPageEnhanced.js

---

## Error Display Patterns

### Inline Error Messages
```javascript
{validationErrors.fieldName && (
  <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '5px' }}>
    ⚠️ {validationErrors.fieldName}
  </div>
)}
```

### Helper Text
```javascript
<div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>
  Format requirement description
</div>
```

### Alert Messages (On Submit)
```javascript
alert(validationError.error);
```

### Global Error Display
```javascript
{error && <div className="error">{error}</div>}
```

---

## Benefits

1. **Prevents Invalid Data Submission**
   - No empty fields reach the backend
   - No malformed amounts or PINs
   - Format consistency guaranteed

2. **Improved User Experience**
   - Real-time feedback as they type
   - Clear guidance on acceptable formats
   - No unexpected server errors

3. **Security**
   - Prevents injection attacks via format validation
   - Length limits prevent buffer overflows
   - Alphanumeric restrictions on sensitive fields

4. **Accessibility**
   - Clear error messages in plain language
   - Visual indicators (red borders)
   - Helper text explains requirements

5. **Backend Protection**
   - Reduces backend error handling burden
   - Only valid data reaches the API
   - Consistent data format from all users

---

## Testing Validation

### Test Cases

#### Customer ID
- ✓ Valid: "cust_123", "customer-1", "MERCHANT001"
- ✗ Invalid: "", "ab" (too short), "a".repeat(21) (too long), "cust@123" (special char)

#### PIN
- ✓ Valid: "1234", "123456"
- ✗ Invalid: "", "123" (too short), "1234567" (too long), "123a" (non-numeric)

#### Amount
- ✓ Valid: "100", "1000.50", "99999.99"
- ✗ Invalid: "", "-100" (negative), "100000.01" (exceeds limit), "100.999" (3 decimals)

#### Merchant ID
- ✓ Valid: "SHOP1", "merchant-001", "store_123"
- ✗ Invalid: "", "a" (too short), "a".repeat(21) (too long), "shop@1" (special char)

#### Chat Message
- ✓ Valid: "What are my transactions?", "Tell me about today"
- ✗ Invalid: "", "   " (whitespace only), "x".repeat(501) (exceeds limit)

---

## Implementation Details

### State Management
Each form component maintains a `validationErrors` state object:
```javascript
const [validationErrors, setValidationErrors] = useState({});
```

### Validation Architecture
- Validation functions are **pure functions** (no side effects)
- Returns `{ valid: boolean, error?: string }`
- Called both on input change (real-time) and form submit (blocking)

### Performance
- Validation is **synchronous** (no async delays)
- Only validates on user input (not on every render)
- Error states cleared on successful submission

---

## Future Enhancements

1. **Backend Validation:** Server-side validation should mirror these rules
2. **Async Validation:** Check username/Merchant ID uniqueness against backend
3. **Localization:** Support multiple languages for error messages
4. **Accessibility:** ARIA labels and descriptions for screen readers
5. **Rate Limiting:** Prevent rapid submission attempts
6. **Custom Validators:** Plugin system for business-specific rules

---

## Commit Information

**Commit Hash:** d1adba0
**Date:** 2026-01-09
**Files Modified:**
- frontend/src/App.js (+100 lines)
- frontend/src/MerchantPageEnhanced.js (+120 lines)
- frontend/src/MerchantPage.js (+80 lines)

**Total Addition:** ~300 lines of validation code and helper text
