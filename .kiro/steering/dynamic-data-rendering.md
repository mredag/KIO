# Dynamic Data Rendering Best Practices

## Critical Rule: Always Use Database Data, Never Hardcode

When building components that display data from a database, **ALWAYS** render the actual data from the database, not hardcoded values or translations.

---

## ❌ Common Anti-Patterns to AVOID

### 1. Hardcoding Questions/Options in Components

**BAD - Hardcoded in Component:**
```typescript
// ❌ DON'T DO THIS
<p>{t('survey.question1')}</p>
<button>{t('survey.option1')}</button>
<button>{t('survey.option2')}</button>
```

**GOOD - Dynamic from Database:**
```typescript
// ✅ DO THIS
<p>{question.text}</p>
{question.options.map(option => (
  <button key={option}>{option}</button>
))}
```

### 2. Using Only Title/Description, Ignoring Content

**BAD - Partial Data Usage:**
```typescript
// ❌ DON'T DO THIS
<h1>{survey.title}</h1>
<p>{t('hardcoded.question')}</p> // Wrong!
```

**GOOD - Full Data Usage:**
```typescript
// ✅ DO THIS
<h1>{survey.title}</h1>
{survey.questions.map(q => (
  <p key={q.id}>{q.text}</p>
))}
```

### 3. Static State for Dynamic Content

**BAD - Fixed State Structure:**
```typescript
// ❌ DON'T DO THIS
const [question1Answer, setQuestion1Answer] = useState(null);
const [question2Answer, setQuestion2Answer] = useState(null);
// What if there are 10 questions?
```

**GOOD - Dynamic State Structure:**
```typescript
// ✅ DO THIS
const [answers, setAnswers] = useState<Record<string, any>>({});
// Works for any number of questions
```

---

## ✅ Best Practices

### 1. Detect Data Changes

Always reset component state when the data source changes:

```typescript
// ✅ Reset when data ID changes
useEffect(() => {
  resetState();
}, [data?.id, resetState]);
```

### 2. Use Dynamic Rendering

Map over arrays instead of hardcoding elements:

```typescript
// ✅ Dynamic rendering
{items.map((item, index) => (
  <div key={item.id}>
    <h3>{item.title}</h3>
    <p>{item.description}</p>
  </div>
))}
```

### 3. Flexible State Management

Use generic state structures that work with any data:

```typescript
// ✅ Generic state
const [currentIndex, setCurrentIndex] = useState(0);
const [selections, setSelections] = useState<Record<string, any>>({});

// Works with any number of items
const currentItem = items[currentIndex];
```

### 4. Validate Data Structure

Check that you're using all relevant fields from the database:

```typescript
// ✅ Check database schema
interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Question[]; // ← Don't forget this!
}

// ✅ Use all fields
<h1>{survey.title}</h1>
<p>{survey.description}</p>
{survey.questions.map(q => ...)} // ← Use this!
```

---

## 🔍 How to Identify Hardcoding Issues

### Red Flags

1. **Using i18n for dynamic content**
   - `t('survey.question1')` ← Red flag if questions come from DB
   - `t('massage.name')` ← Red flag if massages come from DB

2. **Fixed number of elements**
   - Only rendering 2 questions when DB has 7
   - Only showing 3 options when DB has 5

3. **Ignoring database fields**
   - Using `survey.title` but not `survey.questions`
   - Using `massage.name` but not `massage.sessions`

4. **Static switch/case statements**
   ```typescript
   // ❌ Red flag
   switch(survey.type) {
     case 'satisfaction': return <SatisfactionQuestions />;
     case 'discovery': return <DiscoveryQuestions />;
   }
   ```

5. **Component doesn't update when data changes**
   - Changing survey in admin panel doesn't update kiosk
   - Changing massage doesn't update display

---

## 🎯 Checklist Before Implementing

Before creating a component that displays database data:

- [ ] Check the database schema - what fields exist?
- [ ] Check the TypeScript types - what data structure is expected?
- [ ] Will this data change? (surveys, massages, products, etc.)
- [ ] How many items might there be? (2? 10? 100?)
- [ ] Are there nested arrays? (questions, sessions, options)
- [ ] What happens when the data source changes?
- [ ] Am I using ALL relevant fields from the database?
- [ ] Is my state structure flexible enough for any data?

---

## 📋 Common Scenarios

### Scenario 1: Survey Questions

**Database:**
```json
{
  "id": "survey-1",
  "title": "Customer Survey",
  "questions": [
    {
      "id": "q1",
      "text": "How satisfied are you?",
      "type": "rating",
      "options": ["1", "2", "3", "4", "5"]
    },
    {
      "id": "q2",
      "text": "Would you recommend us?",
      "type": "single-choice",
      "options": ["Yes", "No", "Maybe"]
    }
  ]
}
```

**Implementation:**
```typescript
// ✅ CORRECT
function SurveyComponent({ survey }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  
  const currentQuestion = survey.questions[currentIndex];
  
  return (
    <div>
      <h2>{survey.title}</h2>
      <p>{currentQuestion.text}</p>
      {currentQuestion.options.map(option => (
        <button 
          key={option}
          onClick={() => setAnswers({...answers, [currentQuestion.id]: option})}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
```

### Scenario 2: Product Sessions/Pricing

**Database:**
```json
{
  "id": "massage-1",
  "name": "Swedish Massage",
  "sessions": [
    { "name": "30 minutes", "price": 750 },
    { "name": "60 minutes", "price": 1000 },
    { "name": "90 minutes", "price": 1500 }
  ]
}
```

**Implementation:**
```typescript
// ✅ CORRECT
function MassageDisplay({ massage }) {
  return (
    <div>
      <h2>{massage.name}</h2>
      <ul>
        {massage.sessions.map(session => (
          <li key={session.name}>
            {session.name}: {session.price} TL
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Scenario 3: Dynamic Form Fields

**Database:**
```json
{
  "id": "form-1",
  "fields": [
    { "id": "f1", "label": "Name", "type": "text", "required": true },
    { "id": "f2", "label": "Email", "type": "email", "required": true },
    { "id": "f3", "label": "Phone", "type": "tel", "required": false }
  ]
}
```

**Implementation:**
```typescript
// ✅ CORRECT
function DynamicForm({ formConfig }) {
  const [values, setValues] = useState({});
  
  return (
    <form>
      {formConfig.fields.map(field => (
        <div key={field.id}>
          <label>
            {field.label}
            {field.required && <span>*</span>}
          </label>
          <input
            type={field.type}
            value={values[field.id] || ''}
            onChange={(e) => setValues({...values, [field.id]: e.target.value})}
            required={field.required}
          />
        </div>
      ))}
    </form>
  );
}
```

---

## 🚨 Real-World Example: Survey Bug

### The Problem

**Component was doing:**
```typescript
// ❌ WRONG
<h2>{survey.title}</h2> // ✅ From database
<p>{t('survey.question1')}</p> // ❌ Hardcoded in i18n
<button>{t('survey.option1')}</button> // ❌ Hardcoded in i18n
```

**Result:**
- Title changed when survey changed ✅
- Questions stayed the same ❌
- Options stayed the same ❌

### The Fix

```typescript
// ✅ CORRECT
<h2>{survey.title}</h2> // ✅ From database
<p>{survey.questions[currentIndex].text}</p> // ✅ From database
{survey.questions[currentIndex].options.map(option => (
  <button key={option}>{option}</button> // ✅ From database
))}
```

**Result:**
- Title changes when survey changes ✅
- Questions change when survey changes ✅
- Options change when survey changes ✅

---

## 🔧 Testing Dynamic Rendering

### Test 1: Data Change Detection

```typescript
// Test that component updates when data changes
test('updates when data source changes', () => {
  const { rerender } = render(<Component data={data1} />);
  expect(screen.getByText(data1.title)).toBeInTheDocument();
  
  rerender(<Component data={data2} />);
  expect(screen.getByText(data2.title)).toBeInTheDocument();
  expect(screen.queryByText(data1.title)).not.toBeInTheDocument();
});
```

### Test 2: Variable Item Count

```typescript
// Test that component handles different numbers of items
test('renders any number of items', () => {
  const data2Items = { items: [item1, item2] };
  const data5Items = { items: [item1, item2, item3, item4, item5] };
  
  const { rerender } = render(<Component data={data2Items} />);
  expect(screen.getAllByRole('button')).toHaveLength(2);
  
  rerender(<Component data={data5Items} />);
  expect(screen.getAllByRole('button')).toHaveLength(5);
});
```

### Test 3: All Fields Used

```typescript
// Test that all database fields are displayed
test('displays all data fields', () => {
  const data = {
    title: 'Test Title',
    description: 'Test Description',
    items: [
      { id: '1', name: 'Item 1', value: 'Value 1' }
    ]
  };
  
  render(<Component data={data} />);
  expect(screen.getByText(data.title)).toBeInTheDocument();
  expect(screen.getByText(data.description)).toBeInTheDocument();
  expect(screen.getByText(data.items[0].name)).toBeInTheDocument();
  expect(screen.getByText(data.items[0].value)).toBeInTheDocument();
});
```

---

## 📚 Related Patterns

### Pattern 1: Pagination/Navigation

```typescript
// ✅ Generic pagination
const [currentPage, setCurrentPage] = useState(0);
const itemsPerPage = 10;
const totalPages = Math.ceil(items.length / itemsPerPage);

const currentItems = items.slice(
  currentPage * itemsPerPage,
  (currentPage + 1) * itemsPerPage
);
```

### Pattern 2: Filtering

```typescript
// ✅ Dynamic filtering
const [filters, setFilters] = useState({});

const filteredItems = items.filter(item => {
  return Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    return item[key] === value;
  });
});
```

### Pattern 3: Sorting

```typescript
// ✅ Dynamic sorting
const [sortBy, setSortBy] = useState('name');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

const sortedItems = [...items].sort((a, b) => {
  const aVal = a[sortBy];
  const bVal = b[sortBy];
  const order = sortOrder === 'asc' ? 1 : -1;
  return aVal > bVal ? order : -order;
});
```

---

## 🎓 Key Takeaways

1. **Database is the source of truth** - Always render from database, never hardcode
2. **Use all fields** - Don't ignore nested arrays or objects
3. **Detect changes** - Reset state when data ID changes
4. **Be flexible** - State structure should work with any data
5. **Test thoroughly** - Verify component updates when data changes

---

## 🔗 Related Steering Files

- `data-transformation.md` - How to transform data between backend and frontend
- `troubleshooting-quick-reference.md` - Common errors and solutions
- `ui-ux-testing.md` - How to test UI components

---

**Remember:** If data comes from a database, it should be rendered dynamically, not hardcoded!
