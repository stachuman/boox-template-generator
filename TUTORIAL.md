# E-ink PDF Templates - Getting Started Tutorial

## Step 1: Understanding the Basics

Welcome to E-ink PDF Templates! This tutorial will help you understand how to create personalized planners and documents for your e-ink device. Think of this system like a smart printing press that can create hundreds of custom pages automatically.

### What Are Master Pages?

A **master page** is like a template or blueprint for your pages. Instead of designing each page individually, you create one master page and tell the system how to make many similar pages from it.

**Think of it like this:**
- You design a "Daily Page" master with spaces for date, tasks, and notes
- The system can generate 365 unique daily pages (one for each day of the year)
- Each page looks the same but shows different dates and information

**Real Example:**
```
Master Page: "Daily Planner"
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

### How Pages Are Generated

The magic happens when you create a **plan**. A plan tells the system:
1. Which master page to use
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

**Master Page: "Weekend Day"**
- Title: "{weekday} Plans"
- Morning section
- Afternoon section
- Evening section
- Link to "Next Day" (if it exists)

**Plan:**
- Generate 2 pages (Saturday and Sunday)
- Use weekend dates
- Link Saturday → Sunday

**Result:**
- Page 1: "Saturday Plans" with link to Sunday
- Page 2: "Sunday Plans"

### Key Concepts to Remember

1. **Master = Template** - Design once, use many times
2. **Plan = Instructions** - Tells the system what to generate
3. **Variables = Placeholders** - Like {date} that get filled in automatically
4. **Links = Navigation** - Help you jump between related pages

### What's Next?

Now that you understand the basics:
- **Step 2** will show you how to create your first master page
- **Step 3** will teach you how to set up a simple plan
- **Step 4** will cover adding links between pages

The power of this system is that you design once and generate hundreds of personalized pages automatically. No more copying and pasting dates or creating pages one by one!

---

## Step 2: Creating Your First Master Page

Now let's create your first master page! We'll make a simple daily planner page that can be used to generate pages for any date.

### Starting Your Master Page

Think of creating a master page like designing a form that will be filled out automatically. You'll place text, boxes, and placeholders on the page, and the system will fill in the details.

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

### Testing Your Master Page

Before generating multiple pages, test your master page:

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
- Always preview your page before creating the full plan
- Check that text doesn't overlap or run off the page

### Your First Master Page Checklist

Before moving to Step 3, make sure your master page has:

☐ A clear title (with or without date variable)
☐ At least one variable that changes (like `{date}` or `{weekday}`)
☐ Some writing space (boxes for tasks or notes)
☐ Everything positioned and sized properly
☐ Previewed with real dates to check it looks good

### What's Next?

Once your master page looks good:
- **Step 3** will show you how to create a plan to generate multiple pages
- **Step 4** will teach you how to add navigation links between pages

Remember: Master pages are reusable templates. The time you spend getting this one right will save you hours when generating your full planner!

### Quick Example to Try

**Easy First Master Page:**
1. Add title: "Daily Planning Page"
2. Add date: "{date_long}"
3. Add label: "Today's Goals"
4. Add 3 small boxes for checkboxes
5. Add label: "Notes"
6. Add large box for writing
7. Preview and adjust spacing

That's it! You've created your first master page template.

---

## Step 3: Creating Your Plan and Generating Pages

Great! You have a master page. Now let's turn that single template into many pages using a **plan**. Think of a plan as giving instructions to an assistant: "Take this daily page template and make me 31 copies for January."

### What Is a Plan?

A plan is a set of instructions that tells the system:
1. Which master page to use
2. How many pages to create
3. What dates or information to put on each page

**Think of it like ordering custom calendars:**
- You give the printer your page design (master page)
- You tell them "I want 365 pages, one for each day of 2026" (the plan)
- They print all the pages with different dates automatically

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

### Setting Up Your First Plan

Let's create a simple plan using the daily master page you made in Step 2.

**Step-by-Step Plan Creation:**

**1. Choose Your Master Page**
- Select the daily page master you created
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

When you run your plan, here's what the system does:

**Day 1:** Takes your master page
- Replaces `{date_long}` with "Wednesday, January 1, 2026"
- Replaces `{weekday}` with "Wednesday"
- Creates "Page 1" of your final PDF

**Day 2:** Takes your master page again
- Replaces `{date_long}` with "Thursday, January 2, 2026"
- Replaces `{weekday}` with "Thursday"
- Creates "Page 2" of your final PDF

**...and so on for all 31 days**

### Building a Complete Planner

Most planners have multiple sections. Here's a simple structure:

**Section 1: Cover Page**
- Type: Single page
- Master: Cover page design
- Result: 1 page

**Section 2: Monthly Overview**
- Type: Each month
- Master: Monthly calendar view
- Date range: January 1 - December 31
- Result: 12 pages (one per month)

**Section 3: Daily Pages**
- Type: Each day
- Master: Daily planner (the one you made!)
- Date range: January 1 - December 31
- Result: 365 pages (one per day)

**Section 4: Notes**
- Type: Multiple copies
- Master: Blank note page
- Count: 50
- Result: 50 numbered note pages

**Total: 428 pages automatically generated!**

### Plan Settings You Should Know

**Pages Per Day:** Usually 1, but you can have more
- Example: 2 pages per day for morning/evening planning

**Section Order:** The order sections appear in your final PDF
- Cover first, then months, then daily pages, then notes

**Date Formats:** The system handles different date styles
- `{date}`: 2026-01-15
- `{date_long}`: Wednesday, January 15, 2026
- `{weekday}`: Wednesday

### Testing Your Plan

Before generating hundreds of pages:

**1. Start Small**
- Test with just one week (7 pages)
- Check that dates look correct
- Verify page layout works well

**2. Check the Preview**
- Most systems show you what the first few pages will look like
- Make sure variables are filled in correctly
- Confirm spacing and formatting

**3. Generate and Review**
- Create your test PDF
- Open it on your device or computer
- Check a few different pages to ensure consistency

### Common Plan Mistakes to Avoid

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

### Your First Plan Checklist

Before generating your planner:

☐ Master page is tested and looks good
☐ Date range is correct (start and end dates)
☐ Generation type matches what you want (daily, weekly, etc.)
☐ Section name is clear and descriptive
☐ You've tested with a small date range first
☐ Preview shows correct information in variables

### Quick Plan to Try

**Simple January Daily Planner:**
1. Use your daily master page from Step 2
2. Set type to "Each Day"
3. Start date: January 1, 2026
4. End date: January 7, 2026 (just one week for testing)
5. Section name: "January Week 1"
6. Generate and check the result

**What you should get:**
- 7 pages, one for each day of the first week
- Each page shows the correct date and weekday
- All pages use your master page layout

### What's Next?

Once your plan generates pages correctly:
- **Step 4** will show you how to add navigation links between pages
- You'll learn to create "Previous Day" and "Next Day" buttons
- Plus how to link from monthly overviews to specific daily pages

Remember: Plans are reusable! Once you create a good plan, you can use it every year by just changing the dates.

---

## Step 4: Adding Navigation Links

Now for the magic touch - navigation links! These let you jump between pages in your PDF just like clicking links on a website. No more scrolling through hundreds of pages to find what you need.

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

Let's add a simple link to your daily master page that goes to the next day.

**Step-by-Step Link Creation:**

**1. Add a Link Widget**
- In your daily master page, add an "Internal Link" widget
- Position it where you want the clickable area (like bottom right)
- Make it big enough to tap easily with your finger

**2. Set the Link Text**
- Text: "Next Day →"
- This is what users will see and tap

**3. Configure the Link Destination**
- Link template: `day(@date + 1 day)`
- This tells the system "link to tomorrow's page"

**4. Test the Link**
- Preview your page to see the link appear
- When you generate multiple pages, each day will link to the next day

### Understanding Link Templates

Link templates are instructions for where to go. They use the same variables as your pages, but in a special format.

**Common Link Patterns:**

**Daily Navigation:**
```
Previous Day: day(@date - 1 day)
Next Day: day(@date + 1 day)
This Month: month(@year-@month_padded)
```

**Monthly Navigation:**
```
Previous Month: month(@year-@month_padded - 1 month)
Next Month: month(@year-@month_padded + 1 month)
This Year: year(@year)
```

**Section Navigation:**
```
Notes Section: notes(@index)
Back to Index: index:main
Today's Page: day(@today)
```

### Creating Anchor Points

For links to work, you need **anchor points** - these are invisible markers that say "this is the destination."

**Think of anchors like address signs on houses** - the link is directions ("go to 123 Main Street") and the anchor is the house number sign.

**Adding Anchors:**

**1. Add Anchor Widget**
- In your master page, add an "Anchor" widget
- Position doesn't matter - anchors are invisible
- Usually put them at the top of the page

**2. Set the Anchor ID**
- For daily pages: `day:{date}`
- For monthly pages: `month:{year}-{month_padded}`
- For note pages: `notes:{index}`

**3. Match Links to Anchors**
- Link template: `day(@date + 1 day)`
- Becomes: `day:2026-01-16`
- Matches anchor: `day:{date}` on January 16th page
- Which becomes: `day:2026-01-16`

### Building a Navigation System

Let's create a complete navigation system for your planner:

**Daily Page Navigation:**
```
Top of page: "← Jan 2026" (links to monthly overview)
Bottom left: "← Yesterday"
Bottom right: "Tomorrow →"
Bottom center: "Notes" (links to notes section)
Anchor: day:{date}
```

**Monthly Page Navigation:**
```
Top: "← 2026" (links to yearly overview)
Calendar grid: Each day number links to that daily page
Bottom: "← Previous Month" and "Next Month →"
Anchor: month:{year}-{month_padded}
```

**Index Page:**
```
Links to each month: "January", "February", etc.
Link to notes section: "Notes & Ideas"
No anchor needed (this is often the starting point)
```

### Link Preview Feature

When you create links, you'll see a preview showing:
- What you typed: `day(@date + 1 day)`
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
- Link: `day(@date)` → `day:2026-01-15`
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

**Add to your daily master page:**
1. **Next Day Link:**
   - Text: "Tomorrow →"
   - Template: `day(@date + 1 day)`
   - Position: Bottom right

2. **Previous Day Link:**
   - Text: "← Yesterday"
   - Template: `day(@date - 1 day)`
   - Position: Bottom left

3. **Anchor:**
   - ID: `day:{date}`
   - Position: Top of page (invisible)

4. **Test:**
   - Generate 3-5 daily pages
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

You now know how to:
✅ Create master page templates with variables
✅ Build plans that generate hundreds of pages automatically
✅ Add navigation links for easy jumping between pages
✅ Create complete, usable digital planners for your e-ink device

### What You Can Build Now

With these skills, you can create:
- **Daily planners** with full year navigation
- **Project notebooks** with cross-referenced pages
- **Reading logs** with book and chapter navigation
- **Habit trackers** with weekly and monthly views
- **Meeting notebooks** with date-based organization

The system handles all the repetitive work - you just design the templates and set up the navigation once!

### Next Steps Beyond This Tutorial

- **Experiment** with different master page layouts
- **Try weekly and monthly generation** modes
- **Create specialized sections** for different purposes
- **Build template libraries** you can reuse each year
- **Share your designs** with other e-ink users

Remember: The best planners are the ones you actually use. Start simple, test on your device, and gradually add features that make your digital planning more effective.

---

*Happy planning! Your e-ink device just became a powerful, personalized productivity tool.*