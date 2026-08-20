## Purpose

Ensures that Reading, Writing, and Listening practice content scraped from ieltstrainingonline.com
preserves the source's actual paragraph structure, emphasis, and list formatting instead of being
flattened into run-on text, and that Reading question explanations are captured whenever the source
publishes them. This capability governs the scraper output and its rendering, not the practice-taking UX
itself (covered by each practice type's own capability, e.g. `listening-practice`).

## ADDED Requirements

### Requirement: Paragraph and emphasis fidelity in scraped content
The system SHALL preserve the source page's paragraph breaks, bold/emphasis runs, and list items when
scraping Reading passage content, Writing task descriptions/prompts/sample answers, and Listening section
content, and SHALL render that structure back to the user without flattening separate source paragraphs
into a single run of text.

#### Scenario: Two source paragraphs stay visually distinct
- **WHEN** a Reading passage, Writing task, or Listening section is scraped from a source page where the
  content is two separate `<p>` elements
- **THEN** the stored content contains a paragraph break between them, and the practice page renders them
  as two distinct paragraphs, not as one run-on block of text

#### Scenario: Bold source text renders as emphasis
- **WHEN** the source page marks a run of text as bold (`<strong>`/`<b>`)
- **THEN** the stored content preserves that as emphasis, and the practice page renders it visibly bolded

#### Scenario: Previously-scraped plain content still renders correctly
- **WHEN** a test's content was scraped before this capability existed and contains no formatting markers
- **THEN** the practice page renders it exactly as it did before — plain paragraphs split on blank lines —
  with no error, missing text, or visual regression

### Requirement: Reading explanation capture when published by the source
The system SHALL capture and store a Reading question's explanation text whenever the source site
publishes a dedicated explanations page for that test, and SHALL leave the explanation empty (never
fabricated) when the source has no such page.

#### Scenario: Source publishes an explanations page
- **WHEN** a Reading test's practice page links to a separate answers-with-explanations page
- **THEN** the scraper follows that link and stores the matching per-question explanation text against
  each question id it covers

#### Scenario: Source has no explanations page
- **WHEN** a Reading test's practice page has no such link (as is the case for newer Cambridge books)
- **THEN** the question's explanation is left empty, and the practice page's explanation toggle shows no
  explanation for that question rather than an error or placeholder text

### Requirement: No unsanitized third-party HTML reaches the browser
The system SHALL NOT render scraped source HTML directly (e.g. via `dangerouslySetInnerHTML`); formatting
fidelity SHALL be achieved by parsing source structure into a constrained internal representation that is
rendered through ordinary component/element construction.

#### Scenario: Scraped content is rendered as constructed elements, not injected markup
- **WHEN** the practice page renders any scraped Reading, Writing, or Listening content
- **THEN** the rendering path builds React elements from a parsed representation of that content and does
  not pass raw or lightly-sanitized third-party HTML into the DOM via an unsanitized-innerHTML mechanism
