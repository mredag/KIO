# React State Management - Async setState Issues

## Critical Rule: setState is Asynchronous

React's `setState` is **asynchronous** and does not update state immediately. This causes bugs when you need the updated state value right after calling `setState`.

---

## ❌ Common Bug Pattern

### Problem: Auto-Advance with Empty State

```typescript
// ❌ WRONG - State not updated yet
const handleAnswerSelect = (questionId: string, value: any) => {
  setAnswers(prev => ({ ...prev, [questionId]: value }));
  
  // BUG: answers still has old value here!
  setTimeout(() => {
    submitResponse({ answers }); // Submits old/empty answers
  }, 300);
};
```

**Result:** Survey submits with empty answers `{}` because `answers` state hasn't updated yet.

---

## ✅ Solution Patterns

### Pattern 1: Use the New Value Directly

```typescript
// ✅ CORRECT - Use the new value immediately
const handleAnswerSelect = (questionId: string, value: any) => {
  const newAnswers = { ...answers, [questionId]: value };
  setAnswers(newAnswers);
  
  // Use newAnswers, not answers
  setTimeout(() => {
    submitResponse({ answers: newAnswers }); // Submits correct answers
  }, 300);
};
```

### Pattern 2: Use useEffect to React to State Changes

```typescript
// ✅ CORRECT - React to state changes
const [shouldSubmit, setShouldSubmit] = useState(false);

const handleAnswerSelect = (questionId: string, value: any) => {
  setAnswers(prev => ({ ...prev, [questionId]: value }));
  setShouldSubmit(true);
};

useEffect(() => {
  if (shouldSubmit && answers) {
    submitResponse({ answers });
    setShouldSubmit(false);
  }
}, [answers, shouldSubmit]);
```

### Pattern 3: Use Callback in setState

```typescript
// ✅ CORRECT - Use functional update
const handleAnswerSelect = (questionId: string, value: any) => {
  setAnswers(prev => {
    const newAnswers = { ...prev, [questionId]: value };
    
    // Trigger side effect with new value
    setTimeout(() => {
      submitResponse({ answers: newAnswers });
    }, 300);
    
    return newAnswers;
  });
};
```

---

## Real-World Example: Survey Auto-Advance Bug

### The Bug

**Symptom:** Survey responses saved with empty answers `{}` in database

**Cause:** Auto-advance feature called `handleNext()` before `setAnswers()` completed

**Code:**
```typescript
// ❌ BUG
const handleAnswerSelect = (questionId, value, questionType) => {
  setAnswers(prev => ({ ...prev, [questionId]: value }));
  
  if (questionType === 'single-choice') {
    setTimeout(() => {
      handleNext(); // Uses old 'answers' state
    }, 300);
  }
};

const handleNext = () => {
  submitResponse({
    surveyId: survey.id,
    answers, // Empty! State not updated yet
  });
};
```

### The Fix

```typescript
// ✅ FIXED
const handleAnswerSelect = (questionId, value, questionType) => {
  const newAnswers = { ...answers, [questionId]: value };
  setAnswers(newAnswers);
  
  if (questionType === 'single-choice') {
    setTimeout(() => {
      handleNextWithAnswers(newAnswers); // Pass new value directly
    }, 300);
  }
};

const handleNextWithAnswers = (currentAnswers) => {
  submitResponse({
    surveyId: survey.id,
    answers: currentAnswers, // Correct answers!
  });
};
```

---

## When This Bug Occurs

### High-Risk Scenarios

1. **Auto-advance features** - Advancing immediately after state update
2. **Form submissions** - Submitting right after user input
3. **Rapid state changes** - Multiple setState calls in quick succession
4. **Conditional logic** - Using state value immediately after setState
5. **Async operations** - setTimeout/setInterval with state dependencies

### Red Flags

- ⚠️ Using state value in same function after setState
- ⚠️ setTimeout/setInterval immediately after setState
- ⚠️ Submitting forms immediately after state update
- ⚠️ Conditional logic based on just-updated state
- ⚠️ Multiple setState calls without waiting

---

## Testing for This Bug

### Manual Testing

```typescript
// Add console.log to verify state
const handleAnswerSelect = (questionId, value) => {
  console.log('Before setState:', answers);
  setAnswers(prev => ({ ...prev, [questionId]: value }));
  console.log('After setState:', answers); // Still old value!
  
  setTimeout(() => {
    console.log('In setTimeout:', answers); // May still be old!
  }, 300);
};
```

### Database Verification

```javascript
// Check if data is actually saved
const db = require('better-sqlite3')('./data/kiosk.db');
const responses = db.prepare('SELECT answers FROM survey_responses ORDER BY created_at DESC LIMIT 5').all();
responses.forEach(r => {
  console.log('Answers:', r.answers);
  // If you see {} or empty, you have the bug
});
```

---

## Prevention Checklist

Before implementing features with setState:

- [ ] Do I need the updated state value immediately?
- [ ] Am I using the state value in the same function after setState?
- [ ] Am I using setTimeout/setInterval with state?
- [ ] Am I submitting data immediately after setState?
- [ ] Can I pass the new value directly instead of relying on state?

---

## Common Mistakes

### Mistake 1: Assuming Immediate Update

```typescript
// ❌ WRONG
setCount(count + 1);
console.log(count); // Still old value!
```

### Mistake 2: Multiple setState in Sequence

```typescript
// ❌ WRONG - May not work as expected
setName('John');
setAge(30);
submitForm({ name, age }); // May have old values
```

### Mistake 3: Conditional Logic After setState

```typescript
// ❌ WRONG
setIsValid(true);
if (isValid) { // Still old value!
  submit();
}
```

---

## Best Practices

### ✅ DO

1. **Use the new value directly** when you need it immediately
2. **Pass values as parameters** instead of relying on state
3. **Use useEffect** to react to state changes
4. **Test data persistence** in database/API
5. **Add console.logs** during development to verify state

### ❌ DON'T

1. **Don't assume setState is synchronous**
2. **Don't use state immediately after setState**
3. **Don't chain operations** that depend on just-updated state
4. **Don't skip testing** data persistence
5. **Don't ignore empty data** in database

---

## Related Issues

### Issue 1: Form Validation

```typescript
// ❌ WRONG
const handleSubmit = () => {
  setErrors(validateForm(formData));
  if (Object.keys(errors).length === 0) { // Still old errors!
    submit();
  }
};

// ✅ CORRECT
const handleSubmit = () => {
  const newErrors = validateForm(formData);
  setErrors(newErrors);
  if (Object.keys(newErrors).length === 0) {
    submit();
  }
};
```

### Issue 2: Loading States

```typescript
// ❌ WRONG
const fetchData = async () => {
  setLoading(true);
  const data = await api.get();
  setData(data);
  setLoading(false);
  if (!loading) { // Still true!
    showData();
  }
};

// ✅ CORRECT
const fetchData = async () => {
  setLoading(true);
  const data = await api.get();
  setData(data);
  setLoading(false);
  // Don't check loading here, use useEffect or just call showData()
  showData();
};
```

---

## Summary

**The Golden Rule:** Never use state immediately after setState. Either:
1. Use the new value directly (store in variable)
2. Use useEffect to react to state changes
3. Pass values as function parameters

This prevents bugs where data appears to be lost or operations use stale state.

---

**Status:** ✅ Critical Pattern Documented
**Date:** 2025-11-23
**Related Files:** 
- `frontend/src/components/kiosk/SurveyMode.tsx`
- Any component using setState with immediate operations
