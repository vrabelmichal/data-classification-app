# Quick Input Test Scenarios

## Test Cases for Quick Input Fixes

### 1. Position Independence Tests ✅

**Test: Flags anywhere in string**
- Input: `arn-0` → Should check: LSB=Failed, Morph=Not sure, Awesome, Redshift, Nucleus
- Input: `-0arn` → Should check: LSB=Failed, Morph=Not sure, Awesome, Redshift, Nucleus  
- Input: `a-r0n` → Should check: LSB=Failed, Morph=Not sure, Awesome, Redshift, Nucleus
- Input: `1a2r` → Should check: LSB=LSB, Morph=ETG, Awesome, Redshift
- Input: `ra01` → Should check: LSB=Non-LSB, Morph=LTG, Redshift, Awesome

**Expected:** All permutations work correctly, flags are detected anywhere

### 2. Multi-Character Deletion Tests ✅

**Test: Select and delete multiple characters**
- Start: `11arn` (all selected)
- Delete selection
- Expected: All radio buttons and checkboxes should clear

**Test: Partial multi-delete**
- Start: `11arn`
- Select `arn` and delete
- Expected: Radio buttons stay (LSB=LSB, Morph=LTG), all checkboxes clear

**Test: Delete LSB/Morph section**
- Start: `11arn`
- Select `11` and delete
- Expected: Radio buttons clear, checkboxes stay (Awesome, Redshift, Nucleus)

### 3. Standard Input Tests (Original Behavior)

**Test: Sequential typing**
- Type `-` → Should check: LSB=Failed
- Type `1` → Should check: LSB=Failed, Morph=LTG
- Type `a` → Should check: LSB=Failed, Morph=LTG, Awesome
- Type `r` → Should check: LSB=Failed, Morph=LTG, Awesome, Redshift
- Type `n` → Should check: LSB=Failed, Morph=LTG, Awesome, Redshift, Nucleus

**Test: Backspace/delete one by one**
- Start: `-1arn`
- Delete `n` → Nucleus unchecks
- Delete `r` → Redshift unchecks
- Delete `a` → Awesome unchecks
- Delete `1` → Morph clears
- Delete `-` → LSB clears

### 4. Edge Cases

**Test: Empty input**
- Input: `` (empty)
- Expected: All fields clear (radio buttons unselected, checkboxes unchecked)

**Test: Only flags**
- Input: `arn`
- Expected: Only checkboxes selected (Awesome, Redshift, Nucleus)

**Test: Only LSB**
- Input: `-`
- Expected: Only LSB=Failed selected

**Test: Only morphology (should not work)**
- Input: `2` (no LSB)
- Expected: LSB=Nothing, Morph=ETG (first digit is LSB, second is Morph)
- Note: This is expected behavior - first digit is always LSB

**Test: Invalid characters filtered**
- Input: `abc-1xyz` 
- Expected: Only `-1arn` remains (filtered to valid chars)
- Result: LSB=Failed, Morph=LTG, Awesome, Redshift, Nucleus

**Test: Duplicate characters**
- Input: `--11aa`
- Expected: LSB=Failed, Morph=LTG, Awesome (duplicates ignored naturally)

### 5. Form Sync Tests

**Test: Quick input updates when clicking form**
- Click LSB "LSB [1]" radio → Quick input shows `1`
- Click Morph "LTG [1]" radio → Quick input shows `11`
- Check "Awesome" → Quick input shows `11a`
- Check "Valid redshift" → Quick input shows `11ar`
- Check "Visible nucleus" → Quick input shows `11arn`

**Test: Form updates when typing**
- Type `0` → LSB "Non-LSB [0]" should be selected
- Type `2` → Morph "ETG [2]" should be selected
- Quick input should show: `02`

### 6. Focus Management Tests

**Test: Desktop focus on load**
- Load classification page on desktop
- Expected: Quick input field has focus, can type immediately

**Test: Desktop focus after navigation**
- Navigate to next galaxy
- Expected: Quick input field has focus

**Test: Mobile no auto-focus**
- Load classification page on mobile
- Expected: Quick input field does NOT have focus

## Implementation Notes

### Parse Order
1. Identify all flag characters (a, r, n) - position independent
2. Extract numeric/dash characters (-, 0, 1, 2) maintaining order
3. First extracted char = LSB
4. Second extracted char = Morphology

### Example Parsing
```
Input: "ar-n1"
Flags: a=true, r=true, n=true
Extracted: "-1"
Result: LSB=-1, Morph=1, Awesome=true, Redshift=true, Nucleus=true
```

### Valid Character Set
- `-` = Failed fitting (LSB=-1 or Morph=-1)
- `0` = Non-LSB (LSB=0) or Not sure (Morph=0)
- `1` = LSB (LSB=1) or LTG (Morph=1)
- `2` = ETG (Morph=2 only)
- `a` = Awesome flag
- `r` = Valid redshift flag
- `n` = Visible nucleus flag
