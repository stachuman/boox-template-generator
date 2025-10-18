# E-ink PDF Templates - Getting Started Tutorial

## Understanding the Workflow

Welcome to E-ink PDF Templates! This tutorial will help you understand how to create personalized planners and documents for your e-ink device. Think of this system like a smart printing press that can create hundreds of custom pages automatically.

The system follows a simple **3-step workflow**:

**Step 1: Design Pages** - Create reusable page templates (called "page designs")
**Step 2: Define Structure** - Configure how your pages are combined and repeated
**Step 3: Generate PDF** - Create your final PDF file for download

Let's dive into each step!

---

## Step 1: Design Pages - Understanding Page Designs

### What Are Page Designs?

A **page design** is like a template or blueprint for your pages. Instead of designing each page individually, you create one page design and tell the system how to make many similar pages from it.

**Think of it like this:**
- You design a "Daily Page" template with spaces for date, tasks, and notes
- The system can generate 365 unique daily pages (one for each day of the year)
- Each page looks the same but shows different dates and information

**Real Example:**
```
Page Design: "Daily Planner"
├── Date: {date}
├── Weekday: {weekday}
├── Tasks: [ ] [ ] [ ]
└── Notes: ___________

Generated Pages:
├── Page 1: January 1, 2026 (Wednesday)
├── Page 2: January 2, 2026 (Thursday)
├── Page 3: January 3, 2026 (Friday)
└── ... (and so on)
```

### How Pages Are Generated (Step 2: Define Structure)

The magic happens when you **define your PDF structure**. This tells the system:
1. Which page design to use
2. How many pages to create
3. What information to put on each page

**Three Ways to Generate Pages:**

1. **Single Page** - Create one page (like a cover or index)
2. **Repeated Pages** - Create multiple copies with numbers (like 10 note pages)
3. **Date-Based Pages** - Create pages for specific dates (daily, weekly, or monthly)

**Example Plan:**
```
Section 1: Cover Page (1 page)
Section 2: Monthly Overview (12 pages - one per month)
Section 3: Daily Pages (365 pages - one per day)
Section 4: Note Pages (50 numbered pages)
```

### What Are Links and Why Do They Matter?

**Links** let you jump between pages in your PDF, just like clicking links on a website. This is especially useful for large planners where you need to navigate quickly.

**Common Link Patterns:**

1. **Index Links** - From a table of contents to specific pages
   ```
   January → Goes to January monthly page
   February → Goes to February monthly page
   ```

2. **Navigation Links** - Between related pages
   ```
   Today's page has: "← Yesterday | Tomorrow →"
   ```

3. **Reference Links** - From summaries to details
   ```
   Monthly view: "Day 15" → Goes to January 15th daily page
   ```

### Simple Example: Weekend Planner

Let's create a simple weekend planner to understand these concepts:

**Page Design: "Weekend Day"**
- Title: "{weekday} Plans"
- Morning section
- Afternoon section
- Evening section
- Link to "Next Day" (if it exists)

**PDF Structure Configuration:**
- Generate 2 pages (Saturday and Sunday)
- Use weekend dates
- Link Saturday → Sunday

**Result:**
- Page 1: "Saturday Plans" with link to Sunday
- Page 2: "Sunday Plans"

### Key Concepts to Remember

1. **Page Design = Template** - Design once, use many times (Step 1)
2. **PDF Structure = Instructions** - Tells the system what to generate (Step 2)
3. **Variables = Placeholders** - Like {date} that get filled in automatically
4. **Links = Navigation** - Help you jump between related pages
5. **Generate PDF = Final Output** - Create your final PDF file (Step 3)

### What's Next in This Tutorial

This tutorial is organized to match the workflow:
- **Creating Your First Page Design** - Design once, use many times
- **Variable Reference Guide** - Understanding placeholders and formatting
- **Nested Structures** - Advanced organization for complex documents
- **Defining Your PDF Structure** - Configure how pages are combined
- **Adding Navigation Links** - Help users jump between pages

The power of this system is that you design once and generate hundreds of personalized pages automatically. No more copying and pasting dates or creating pages one by one!

---

## Creating Your First Page Design

Now let's create your first page design! We'll make a simple daily planner page that can be used to generate pages for any date. This is what you'll do in **Step 1: Design Pages** in the UI.

### Starting Your Page Design

Think of creating a page design like designing a form that will be filled out automatically. You'll place text, boxes, and placeholders on the page, and the system will fill in the details.

**What we'll create:** A daily page with date, weather space, tasks, and notes.

### Adding Basic Elements

**1. Text Blocks - For Labels and Titles**

Text blocks are like putting labels on your page. You can add:
- Fixed text (like "Today's Tasks" or "Notes")
- Variable text (like the actual date)

**Example:**
```
Title: "Daily Planner for {date_long}"
```
This will become: "Daily Planner for Wednesday, January 15, 2026"

**2. Boxes - For Writing Spaces**

Boxes create areas where you can write with your stylus. Think of them as drawing rectangles on your page for different purposes.

**Common box types:**
- Task boxes (small squares for checkboxes)
- Note areas (large rectangles for writing)
- Weather boxes (medium squares for weather icons)

### Using Variables (The Magic Part!)

Variables are placeholders that get replaced with real information. They're written in curly braces like `{date}`.

**Most Useful Variables:**

- `{date}` → 2026-01-15
- `{date_long}` → Wednesday, January 15, 2026
- `{weekday}` → Wednesday
- `{month_name}` → January
- `{day}` → 15
- `{month:02d}` → 01 (month with leading zero)
- `{day:02d}` → 05 (day with leading zero)

**Format Specifiers:**

You can format numbers with padding using the `:02d` syntax:
- `{day}` → 1, 2, 3... 31 (no padding)
- `{day:02d}` → 01, 02, 03... 31 (always 2 digits)
- `{month:02d}` → 01, 02... 12 (always 2 digits)
- `{index:03d}` → 001, 002... 100 (always 3 digits)

**Pro Tip:** When you type a variable, you'll see a preview showing what it will look like!

### Simple Daily Page Layout

Here's a step-by-step layout for your first master page:

**Top Section:**
```
Title: "Daily Planner"
Date: "{date_long}"
Weather Box: [Empty square for weather sketch]
```

**Middle Section:**
```
"Today's Priority Tasks"
☐ Task Box 1
☐ Task Box 2
☐ Task Box 3
```

**Bottom Section:**
```
"Notes & Reflections"
[Large writing area]
```

### Positioning Your Elements

The page editor works like arranging furniture in a room:

1. **Drag and Drop** - Move elements around the page
2. **Resize** - Make boxes bigger or smaller by dragging corners
3. **Align** - Line up elements to look neat

**Layout Tips:**
- Leave white space - don't cram everything together
- Align elements in rows and columns
- Make writing areas big enough for actual use

### Testing Your Page Design

Before generating multiple pages, test your page design:

1. **Preview** - See how it looks with real date information
2. **Check spacing** - Make sure everything fits nicely
3. **Test variables** - Verify dates and text appear correctly

**What you should see:**
Instead of `{date_long}`, you'll see "Wednesday, January 15, 2026" (or whatever date you choose).

### Common Beginner Mistakes to Avoid

**1. Too Many Variables**
- Start simple with just date and weekday
- Add more variables later as you get comfortable

**2. Boxes Too Small**
- Make writing areas bigger than you think you need
- Remember you'll be writing with a stylus, not a fine pen

**3. Forgetting to Test**
- Always preview your page before defining your PDF structure
- Check that text doesn't overlap or run off the page

### Your First Page Design Checklist

Before moving to Step 2, make sure your page design has:

☐ A clear title (with or without date variable)
☐ At least one variable that changes (like `{date}` or `{weekday}`)
☐ Some writing space (boxes for tasks or notes)
☐ Everything positioned and sized properly
☐ Previewed with real dates to check it looks good

### What's Next?

Once your page design looks good, proceed to **Step 2: Define Structure** where you'll configure how your pages are combined and repeated in your final PDF.

Remember: Page designs are reusable templates. The time you spend getting this one right will save you hours when generating your full planner!

### Quick Example to Try

**Easy First Page Design:**
1. Add title: "Daily Planning Page"
2. Add date: "{date_long}"
3. Add label: "Today's Goals"
4. Add 3 small boxes for checkboxes
5. Add label: "Notes"
6. Add large box for writing
7. Preview and adjust spacing

That's it! You've created your first page design template.

---

## Variable Reference Guide

This section provides a complete reference for all available variables and formatting options.

### Date and Time Variables

**Basic Date Variables:**
- `{date}` - ISO format: 2026-01-15
- `{date_long}` - Full format: Wednesday, January 15, 2026
- `{weekday}` - Day name: Wednesday
- `{weekday_short}` - Abbreviated: Wed
- `{month_name}` - Month name: January
- `{month_short}` - Abbreviated: Jan

**Numeric Date Components:**
- `{year}` - Full year: 2026
- `{month}` - Month number: 1, 2... 12
- `{day}` - Day number: 1, 2... 31
- `{week}` - Week number in year: 1, 2... 52

**Formatted Date Components (with padding):**
- `{month:02d}` - Padded month: 01, 02... 12
- `{day:02d}` - Padded day: 01, 02... 31
- `{week:02d}` - Padded week: 01, 02... 52

### Index and Page Variables

**For Multi-Copy Pages:**
- `{index}` - Current copy number: 1, 2, 3...
- `{index:02d}` - Padded to 2 digits: 01, 02, 03...
- `{index:03d}` - Padded to 3 digits: 001, 002, 003...

**For Section Information:**
- `{section_name}` - Name of current plan section
- `{total_pages}` - Total pages in this section

### Format Specifier Syntax

The `:02d` syntax controls how numbers are displayed:

**Pattern: `{variable:0Nd}`**
- `0` - Pad with zeros (can also use spaces)
- `N` - Total width (number of digits)
- `d` - Decimal integer format

**Examples:**
```
{day:02d}      → 01, 02... 31 (always 2 digits)
{index:03d}    → 001, 002... 999 (always 3 digits)
{week:2d}      → 1, 2... 52 (at least 2 digits, no leading zeros)
{month:02d}    → 01, 02... 12 (always 2 digits)
```

**Common Use Cases:**
- File naming: `page_{index:03d}.pdf` → page_001.pdf, page_002.pdf
- Padded dates: `{year}-{month:02d}-{day:02d}` → 2026-01-05
- Sequential IDs: `note_{index:04d}` → note_0001, note_0002

### Variable Usage in Different Contexts

**In Text Widgets:**
```
"Today is {date_long}"           → Today is Wednesday, January 15, 2026
"Page {index:03d} of 365"        → Page 001 of 365
"Week {week} - {month_name}"     → Week 3 - January
```

**In Link Templates:**
```
day({date} + 1 day)              → Links to tomorrow
month({year}-{month:02d})        → Links to current month
notes({index})                    → Links to note by index
```

**In Anchor IDs:**
```
day:{date}                        → day:2026-01-15
month:{year}-{month:02d}         → month:2026-01
note:{index:03d}                  → note:001
```

### Calendar-Specific Variables

When using the Calendar widget, additional variables are available:

**Calendar Display:**
- `{year}` - Year for the calendar
- `{month}` - Month number (1-12)
- `{month_name}` - Full month name

**Calendar Configuration:**
- Use `{year}` and `{month}` to set which month to display
- Calendar automatically shows all days in that month
- Can include week numbers if configured

### Best Practices for Variables

**1. Use Padding for Sorting:**
- `{index:03d}` ensures proper alphabetical sorting
- `{month:02d}-{day:02d}` keeps dates in order

**2. Match Link and Anchor Formats:**
- If link uses `day({date})`, anchor must use `day:{date}`
- If link uses `month({year}-{month:02d})`, anchor must use `month:{year}-{month:02d}`

**3. Preview Before Generating:**
- Always check the variable preview to see actual values
- Verify formatting appears as expected
- Test with edge cases (month 12, day 31, etc.)

**4. Keep It Simple:**
- Start with basic variables like `{date}` and `{weekday}`
- Add formatting when you need specific output
- Don't over-complicate if simple variables work

---

## Advanced: Nested Structures and Custom Variables

Once you're comfortable with the basics of **Step 2: Define Structure**, you can create more complex documents using **nested structures**. This is useful when you need pages organized in multiple levels, like projects containing meetings, or courses containing lessons.

### What Are Nested Structures?

Think of nested structures like folders within folders on your computer:
- **Projects folder** (5 projects)
  - **Project 1** has its own page
    - **Meetings folder** (10 meetings for this project)
      - Meeting 1 page
      - Meeting 2 page
      - ... and so on

Instead of just creating one flat list of pages, nested structures let you create hierarchies where each parent item can have multiple child items.

### Real-World Example: Meeting Notebook

Let's say you manage 5 different projects, and each project has 10 meetings throughout the year.

**Without nesting** (the hard way):
- You'd need to manually track which meetings belong to which project
- You'd create 50 separate meeting pages with confusing names
- Hard to organize and navigate

**With nesting** (the smart way):
- Create 1 "Project Index" master page
- Create 1 "Meeting Note" master page
- Set up a nested plan that automatically creates:
  - 5 project index pages (one per project)
  - 10 meeting pages under each project (50 meeting pages total)
- Each meeting page knows which project it belongs to

### How Nested Structures Work

**Parent Section** creates the outer loop:
- Generates pages for each main item (like projects)
- Passes information down to child sections

**Child Section** creates the inner loop:
- Generates pages for each sub-item (like meetings)
- Receives information from the parent (which project we're in)
- Can add its own information (which meeting number)

**Think of it like a recipe that repeats:**
```
For each project (1 to 5):
  - Make 1 project index page
  - For each meeting (1 to 10):
    - Make 1 meeting note page
```

### Setting Up Your First Nested Structure

Let's create a simple project meeting notebook.

**Part 1: Design Your Pages (Step 1)**

**Project Index Page Design:**
- Title: "Project {project_id}"
- Section for project overview
- Links to meetings 1-10 for this project

**Meeting Note Page Design:**
- Title: "Project {project_id} - Meeting {meeting_id}"
- Date: {date_long}
- Meeting notes area

**Part 2: Define Structure (Step 2)**

**Parent Section - Projects:**
- Section name: "projects"
- Page design: "Project Index"
- Generate: Multiple copies
- Count: 5 (for 5 projects)
- Custom variable: `project_id` starting at 1

**Child Section - Meetings** (nested inside projects):
- Section name: "meetings"
- Page design: "Meeting Note"
- Generate: Multiple copies
- Count: 10 (for 10 meetings per project)
- Custom variable: `meeting_id` starting at 1

**What Gets Generated:**
```
Page 1: Project 1 Index
Pages 2-11: Project 1, Meetings 1-10
Page 12: Project 2 Index
Pages 13-22: Project 2, Meetings 1-10
Page 23: Project 3 Index
Pages 24-33: Project 3, Meetings 1-10
... and so on
Total: 5 + (5 × 10) = 55 pages
```

### Understanding Custom Variables

Custom variables are like creating your own placeholders. Instead of just using dates, you can track things like project numbers, meeting numbers, or any sequence you need.

**Built-in vs Custom Variables:**

**Built-in** (provided by the system):
- `{date}` - Today's date
- `{weekday}` - Day of the week
- `{month}` - Month number

**Custom** (you create them):
- `{project_id}` - Which project (1, 2, 3, 4, 5)
- `{meeting_id}` - Which meeting (1, 2, 3... 10)
- `{chapter}` - Chapter number
- `{lesson_num}` - Lesson number

**How Custom Variables Work:**

When you set up a custom variable called `project_id`:
1. Starting value: 1
2. Step: 1 (increase by 1 each time)
3. The system generates:
   - First page: `{project_id}` = 1
   - Second page: `{project_id}` = 2
   - Third page: `{project_id}` = 3
   - And so on...

### Variable Inheritance: Parents Pass to Children

This is the magic part: **child sections automatically receive all parent variables**.

**Example:**
- Project 1 creates pages with `{project_id}` = 1
- All 10 meetings under Project 1 also have `{project_id}` = 1
- Each meeting also has its own `{meeting_id}` (1, 2, 3... 10)

**So on a meeting page you can use:**
- `{project_id}` - Inherited from parent (which project we're in)
- `{meeting_id}` - From this section (which meeting this is)

**Example meeting title:**
```
"Project {project_id} - Meeting {meeting_id}"

Becomes:
Project 1 - Meeting 1
Project 1 - Meeting 2
...
Project 1 - Meeting 10
Project 2 - Meeting 1
Project 2 - Meeting 2
... and so on
```

### Rules for Nested Structures

**1. Maximum Depth: 3 Levels**
You can nest up to 3 levels deep:
- Level 1: Projects
  - Level 2: Meetings
    - Level 3: Tasks

**2. Unique Variable Names**
Parent and child sections must use different variable names:
- ✅ Good: Parent uses `project_id`, child uses `meeting_id`
- ❌ Bad: Parent uses `id`, child also uses `id` (conflict!)

**3. Variables Add Up**
Each level can see all variables from levels above:
- Project pages see: `{project_id}`
- Meeting pages see: `{project_id}`, `{meeting_id}`
- Task pages see: `{project_id}`, `{meeting_id}`, `{task_id}`

**4. Page Counts Multiply**
Be careful with large numbers:
- 5 projects × 10 meetings = 50 pages ✅
- 10 projects × 50 meetings × 20 tasks = 10,000 pages ❌ (too many!)

### Common Use Cases for Nested Structures

**1. Course Materials:**
```
Courses (5 courses)
  └─ Lessons (12 lessons per course)
     └─ Exercises (5 exercises per lesson)
Total: 5 + 60 + 300 = 365 pages
```

**2. Reading Log:**
```
Books (20 books)
  └─ Chapters (10 chapters per book)
Total: 20 + 200 = 220 pages
```

**3. Project Management:**
```
Projects (3 projects)
  └─ Sprints (8 sprints per project)
     └─ Daily Standups (10 days per sprint)
Total: 3 + 24 + 240 = 267 pages
```

**4. Weekly Planning:**
```
Months (12 months)
  └─ Weeks (4 weeks per month)
     └─ Days (7 days per week)
Total: 12 + 48 + 336 = 396 pages
```

### Setting Up Custom Variables

When creating a plan section, you can add custom variables:

**Configuration:**
- Variable name: `project_id` (must be unique within this hierarchy)
- Starting value: 1
- Step: 1 (increase by 1 each time)

**Advanced Options:**
- Start at different numbers: `chapter` starts at 0
- Skip numbers: Step by 5 (5, 10, 15, 20...)
- Count backwards: Step by -1 (10, 9, 8, 7...)

### Navigation with Nested Structures

Links work great with nested structures:

**From Project Index to Meetings:**
```
Link text: "Meeting {meeting_id}"
Link template: meeting({project_id}:{meeting_id})
```

**From Meeting back to Project:**
```
Link text: "← Back to Project {project_id}"
Link template: project({project_id})
```

**Between Meetings:**
```
Next meeting: meeting({project_id}:{meeting_id} + 1)
Previous meeting: meeting({project_id}:{meeting_id} - 1)
```

### Tips for Success with Nested Structures

**1. Start Small**
- Test with 2 projects × 3 meetings first
- Make sure variables work correctly
- Then scale up to full size

**2. Check Your Math**
- Calculate total pages before generating
- 5 × 10 × 20 = 1,000 pages (might be too many!)
- Stay under 1,000 pages for best performance

**3. Use Clear Variable Names**
- `project_id`, `meeting_id`, `task_id` (clear and different)
- Not: `id`, `num`, `index` (confusing when nested)

**4. Test Navigation**
- Make sure links work between levels
- Parent should link to children
- Children should link back to parent

### Common Mistakes to Avoid

**1. Same Variable Names**
- Parent: `id` = 1
- Child: `id` = 5
- **Problem:** Child overwrites parent value!
- **Solution:** Use `project_id` and `meeting_id`

**2. Too Many Pages**
- 10 × 100 × 50 = 50,000 pages
- **Problem:** Too large, system will reject
- **Solution:** Keep total under 1,000 pages

**3. Forgetting Inheritance**
- Child meeting page tries to use `{project_id}`
- But you didn't realize it's automatically available!
- **Solution:** All parent variables automatically work in child pages

**4. Wrong Nesting Level**
- Trying to nest 4 or 5 levels deep
- **Problem:** Maximum is 3 levels
- **Solution:** Simplify your structure or combine levels

### When to Use Nested Structures

**Use nesting when:**
- You have natural hierarchies (projects → meetings → tasks)
- Child items belong to specific parent items
- You want automatic numbering within each parent

**Don't use nesting when:**
- All pages are independent (just use multiple sections)
- You only need simple date-based pages (use "Each Day" mode)
- Structure is flat (like 365 daily pages)

### Quick Nested Structure to Try

**Simple Book Reading Log:**

**Page Design 1: Book Index**
- Title: "Book {book_num}: {book_title}"
- Variable: `book_title` (you can add custom text variables too!)

**Page Design 2: Chapter Notes**
- Title: "Book {book_num} - Chapter {chapter}"
- Notes area for chapter summary

**Structure Configuration:**
- Parent Section "books": 3 copies with `book_num`
- Child Section "chapters": 10 copies with `chapter`

**Result:**
- 3 book index pages
- 30 chapter note pages (10 per book)
- Each chapter knows which book it belongs to

---

## Step 2: Define Structure - Configuring Your PDF

Great! You have your page designs from **Step 1: Design Pages**. Now let's turn those templates into many pages by configuring your PDF structure. Think of this as giving instructions to an assistant: "Take this daily page design and make me 31 copies for January."

This is what you'll do in **Step 2: Define Structure** in the UI.

### What Is PDF Structure?

Your PDF structure configuration tells the system:
1. Which page design to use
2. How many pages to create
3. What dates or information to put on each page

**Think of it like ordering custom calendars:**
- You give the printer your page design (from Step 1)
- You tell them "I want 365 pages, one for each day of 2026" (Step 2: structure)
- They print all the pages with different dates automatically (Step 3: generation)

### The Three Types of Page Generation

**1. Single Page** - Create just one page
- Good for: Cover pages, yearly overview, index pages
- Example: "Make 1 cover page"

**2. Multiple Copies** - Create several identical pages with numbers
- Good for: Note pages, blank pages, project pages
- Example: "Make 50 note pages numbered 1, 2, 3... 50"

**3. Date-Based Pages** - Create pages for specific dates
- Good for: Daily pages, weekly pages, monthly pages
- Example: "Make daily pages from January 1 to December 31"

### Setting Up Your First Structure

Let's create a simple structure configuration using the daily page design you created in Step 1.

**Step-by-Step Structure Creation:**

**1. Choose Your Page Design**
- Select the daily page design you created
- The system will use this as the template

**2. Pick Generation Type**
- For daily pages, choose "Each Day"
- This tells the system to make one page per day

**3. Set Your Date Range**
- Start date: January 1, 2026
- End date: January 31, 2026
- This creates 31 daily pages for January

**4. Name Your Section**
- Call it something like "January Daily Pages"
- This helps you organize multiple sections later

### Understanding What Happens

When you configure your structure, here's what the system does:

**Day 1:** Takes your page design
- Replaces `{date_long}` with "Wednesday, January 1, 2026"
- Replaces `{weekday}` with "Wednesday"
- Creates "Page 1" of your final PDF

**Day 2:** Takes your page design again
- Replaces `{date_long}` with "Thursday, January 2, 2026"
- Replaces `{weekday}` with "Thursday"
- Creates "Page 2" of your final PDF

**...and so on for all 31 days**

### Building a Complete Planner

Most planners have multiple sections. Here's a simple structure configuration:

**Section 1: Cover Page**
- Type: Single page
- Page design: Cover page design
- Result: 1 page

**Section 2: Monthly Overview**
- Type: Each month
- Page design: Monthly calendar view
- Date range: January 1 - December 31
- Result: 12 pages (one per month)

**Section 3: Daily Pages**
- Type: Each day
- Page design: Daily planner (the one you made!)
- Date range: January 1 - December 31
- Result: 365 pages (one per day)

**Section 4: Notes**
- Type: Multiple copies
- Page design: Blank note page
- Count: 50
- Result: 50 numbered note pages

**Total: 428 pages automatically generated!**

### Structure Settings You Should Know

**Pages Per Day:** Usually 1, but you can have more
- Example: 2 pages per day for morning/evening planning

**Section Order:** The order sections appear in your final PDF
- Cover first, then months, then daily pages, then notes

**Date Formats:** The system handles different date styles
- `{date}`: 2026-01-15
- `{date_long}`: Wednesday, January 15, 2026
- `{weekday}`: Wednesday
- `{month:02d}`: 01 (padded month number)
- `{day:02d}`: 05 (padded day number)

### Testing Your Structure

Before generating hundreds of pages:

**1. Start Small**
- Test with just one week (7 pages)
- Check that dates look correct
- Verify page layout works well

**2. Check the Preview**
- The system will show you what the first few pages will look like
- Make sure variables are filled in correctly
- Confirm spacing and formatting

**3. Generate and Review** (Step 3)
- Create your test PDF
- Open it on your device or computer
- Check a few different pages to ensure consistency

### Common Structure Mistakes to Avoid

**1. Wrong Date Range**
- Double-check start and end dates
- Remember: January 31, not January 30

**2. Forgetting Leap Years**
- 2026 is not a leap year (February has 28 days)
- 2028 will be a leap year (February has 29 days)

**3. Too Many Pages at Once**
- Start with one month, not the whole year
- Large PDFs can be slow to generate and load

**4. Mixed Up Section Order**
- Put cover pages first
- Put reference pages (like notes) at the end

### Your Structure Configuration Checklist

Before generating your planner (Step 3):

☐ Page designs are tested and look good (Step 1 complete)
☐ Date range is correct (start and end dates)
☐ Generation type matches what you want (daily, weekly, etc.)
☐ Section name is clear and descriptive
☐ You've tested with a small date range first
☐ Preview shows correct information in variables

### Quick Structure to Try

**Simple January Daily Planner:**
1. Use your daily page design from earlier
2. Set type to "Each Day"
3. Start date: January 1, 2026
4. End date: January 7, 2026 (just one week for testing)
5. Section name: "January Week 1"
6. Generate and check the result (Step 3)

**What you should get:**
- 7 pages, one for each day of the first week
- Each page shows the correct date and weekday
- All pages use your page design layout

### What's Next?

Once your structure generates pages correctly:
- **Adding Navigation Links** section will show you how to add navigation between pages
- You'll learn to create "Previous Day" and "Next Day" buttons
- Plus how to link from monthly overviews to specific daily pages

Remember: Structure configurations are reusable! Once you create a good structure, you can use it every year by just changing the dates.

---

## Adding Navigation Links

Now for the magic touch - navigation links! These let you jump between pages in your PDF just like clicking links on a website. No more scrolling through hundreds of pages to find what you need.

You add navigation links when designing your pages in **Step 1: Design Pages**.

### Why Links Matter for E-ink Devices

On your e-ink tablet, flipping through 365 daily pages to find "March 15th" would be tedious. With links, you can:
- Jump from January overview directly to January 15th
- Go from today's page to tomorrow's page
- Return to the main index from anywhere
- Navigate between related sections instantly

**Think of links like creating a digital table of contents with instant access.**

### Types of Navigation Links

**1. Index Links** - From overview pages to specific pages
- Monthly overview → Specific daily pages
- Table of contents → Chapter pages
- Year view → Month pages

**2. Sequential Links** - Between consecutive pages
- "← Previous Day" and "Next Day →"
- "← Previous Week" and "Next Week →"
- Page-by-page navigation

**3. Section Links** - Between different types of pages
- Daily page → Notes section
- Notes page → Back to today
- Any page → Main index

### Adding Your First Link

Let's add a simple link to your daily page design that goes to the next day.

**Step-by-Step Link Creation:**

**1. Add a Link Widget**
- In your daily page design (Step 1), add an "Internal Link" widget
- Position it where you want the clickable area (like bottom right)
- Make it big enough to tap easily with your finger

**2. Set the Link Text**
- Text: "Next Day →"
- This is what users will see and tap

**3. Configure the Link Destination**
- Link template: `day({date} + 1 day)`
- This tells the system "link to tomorrow's page"

**4. Test the Link**
- Preview your page to see the link appear
- When you generate multiple pages (Step 2 & 3), each day will link to the next day

### Understanding Link Templates

Link templates are instructions for where to go. They use the same variables as your pages, but in a special format.

**Common Link Patterns:**

**Daily Navigation:**
```
Previous Day: day({date} - 1 day)
Next Day: day({date} + 1 day)
This Month: month({year}-{month:02d})
```

**Monthly Navigation:**
```
Previous Month: month({year}-{month:02d} - 1 month)
Next Month: month({year}-{month:02d} + 1 month)
This Year: year({year})
```

**Section Navigation:**
```
Notes Section: notes({index})
Back to Index: index:main
Today's Page: day({today})
```

### Creating Anchor Points

For links to work, you need **anchor points** - these are invisible markers that say "this is the destination."

**Think of anchors like address signs on houses** - the link is directions ("go to 123 Main Street") and the anchor is the house number sign.

**Adding Anchors:**

**1. Add Anchor Widget**
- In your page design (Step 1), add an "Anchor" widget
- Position doesn't matter - anchors are invisible
- Usually put them at the top of the page

**2. Set the Anchor ID**
- For daily pages: `day:{date}`
- For monthly pages: `month:{year}-{month:02d}`
- For note pages: `notes:{index}`

**3. Match Links to Anchors**
- Link template: `day({date} + 1 day)`
- Becomes: `day:2026-01-16`
- Matches anchor: `day:{date}` on January 16th page
- Which becomes: `day:2026-01-16`

### Building a Navigation System

Let's create a complete navigation system for your planner. Remember, you add these widgets when designing your pages in **Step 1**:

**Daily Page Design Navigation:**
```
Top of page: "← Jan 2026" (links to monthly overview)
Bottom left: "← Yesterday"
Bottom right: "Tomorrow →"
Bottom center: "Notes" (links to notes section)
Anchor: day:{date}
```

**Monthly Page Design Navigation:**
```
Top: "← 2026" (links to yearly overview)
Calendar grid: Each day number links to that daily page
Bottom: "← Previous Month" and "Next Month →"
Anchor: month:{year}-{month:02d}
```

**Index Page:**
```
Links to each month: "January", "February", etc.
Link to notes section: "Notes & Ideas"
No anchor needed (this is often the starting point)
```

### Link Preview Feature

When you create links, you'll see a preview showing:
- What you typed: `day({date} + 1 day)`
- What it becomes: `day:2026-01-16, day:2026-01-17...`
- Required anchor format: `day:{date}`

**This preview helps you ensure:**
- Your link template is correct
- You'll create matching anchors
- The system can connect links to destinations

### Testing Your Navigation

**1. Create a Small Test**
- Make 3 daily pages (January 1-3)
- Add "Next Day" links and anchors
- Generate the PDF and test clicking

**2. Check Link Behavior**
- Click "Next Day" on January 1st → Should go to January 2nd
- Click "Next Day" on January 2nd → Should go to January 3rd
- Click "Next Day" on January 3rd → Might show error (no January 4th)

**3. Handle Edge Cases**
- Last day of month: Link to next month's first day
- Last day of year: Link to next year or back to index
- First day: Previous link goes to index or previous month

### Common Link Mistakes to Avoid

**1. Mismatched Link and Anchor Names**
- Link: `day({date})` → `day:2026-01-15`
- Anchor: `daily:{date}` → `daily:2026-01-15`
- **Problem:** "day" ≠ "daily" - link won't work

**2. Forgetting Anchors**
- Creating links but no anchor destinations
- Links will show error when clicked

**3. Complex Date Math**
- Avoid complicated date calculations initially
- Start with simple "next day" and "previous day"
- Add month/year navigation later

**4. Too Many Links**
- Don't overwhelm pages with navigation
- 2-4 main navigation links per page is plenty

### Your Navigation Checklist

For each page type, ensure you have:

☐ **Links are useful** - Help users get where they want to go
☐ **Links match anchors** - Same naming format (day, month, notes, etc.)
☐ **Anchors exist** - Every link destination has an anchor
☐ **Links are testable** - Preview shows correct destinations
☐ **Links are discoverable** - Clear text like "Next Day →"
☐ **Links are tappable** - Big enough for finger taps on e-ink screen

### Quick Navigation to Try

**Add to your daily page design (Step 1):**
1. **Next Day Link:**
   - Text: "Tomorrow →"
   - Template: `day({date} + 1 day)`
   - Position: Bottom right

2. **Previous Day Link:**
   - Text: "← Yesterday"
   - Template: `day({date} - 1 day)`
   - Position: Bottom left

3. **Anchor:**
   - ID: `day:{date}`
   - Position: Top of page (invisible)

4. **Test:**
   - Configure structure for 3-5 daily pages (Step 2)
   - Generate the PDF (Step 3)
   - Check that links work between consecutive days

### Advanced Navigation Ideas

Once you're comfortable with basic links:

**Smart Monthly Links:**
- Link to "First Monday of Month"
- Link to "Last Day of Month"
- Link to "Same Day Next Month"

**Context-Aware Links:**
- Weekend pages link to "Monday Planning"
- Weekday pages link to "Weekend Review"
- Month-end pages link to "Monthly Review"

**Cross-Reference Links:**
- From daily page to related project notes
- From notes back to relevant daily pages
- From monthly overview to weekly summaries

### Congratulations!

You now know how to use the complete 3-step workflow:
✅ **Step 1: Design Pages** - Create page templates with variables and navigation
✅ **Step 2: Define Structure** - Configure how pages are combined and repeated
✅ **Step 3: Generate PDF** - Create your final PDF file for download
✅ Create complete, usable digital planners for your e-ink device

### What You Can Build Now

With these skills, you can create:
- **Daily planners** with full year navigation
- **Project notebooks** with cross-referenced pages
- **Reading logs** with book and chapter navigation
- **Habit trackers** with weekly and monthly views
- **Meeting notebooks** with date-based organization

The system handles all the repetitive work - you just design the templates and configure the structure once!

### Next Steps Beyond This Tutorial

- **Experiment** with different page layouts (Step 1)
- **Try weekly and monthly generation** modes (Step 2)
- **Create specialized sections** for different purposes
- **Build template libraries** you can reuse each year
- **Share your projects** with other e-ink users (Optional: Share tab)

Remember: The best planners are the ones you actually use. Start simple, test on your device, and gradually add features that make your digital planning more effective.

---

*Happy planning! Your e-ink device just became a powerful, personalized productivity tool.*