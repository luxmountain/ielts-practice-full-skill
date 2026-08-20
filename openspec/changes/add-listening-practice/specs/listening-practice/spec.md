## Purpose

Lets a user browse and answer Cambridge IELTS Listening tests (books 10-21) inside the app - working
through each section's questions and checking against the correct answers - with their scores and answers
saved across sessions, the same way Reading practice already works. Audio playback is not part of this
capability; users source and listen to the audio themselves outside the app.

## ADDED Requirements

### Requirement: Test selection and navigation
The system SHALL let the user browse and open any Cambridge Listening test for books 10-21 from both the
sidebar navigation and the dashboard, following the same book/test grouping already used for Reading.

#### Scenario: Opening a listening test from the sidebar
- **WHEN** the user expands the Listening section in the sidebar and selects a book and test number
- **THEN** the system navigates to that test's practice page and loads its questions

### Requirement: Answer entry and scoring
The system SHALL let the user enter an answer for each question in a listening test, submit the test once,
and see their score (correct count out of total) along with which answers were right or wrong, matching
case-insensitively and trimmed of surrounding whitespace the same way Reading scoring works.

#### Scenario: Submitting a completed test
- **WHEN** the user has entered answers for some or all questions and clicks submit
- **THEN** the system marks the test as submitted, computes the number of correct answers by comparing
  each entry against the stored answer key, and displays the resulting score

#### Scenario: Reviewing answers after submission
- **WHEN** a test has been submitted
- **THEN** the system marks each question as correct or incorrect and shows the correct answer for any
  question the user got wrong or left blank, and disables further edits to that attempt until reset

### Requirement: Progress persistence
The system SHALL persist each listening test's completion state, score, submitted answers, and time spent
to the user's local progress store, and SHALL restore that state when the user reopens a previously
attempted test.

#### Scenario: Resuming a previously submitted test
- **WHEN** the user reopens a listening test they already submitted in an earlier session
- **THEN** the system loads their saved answers and score without requiring them to retake the test

#### Scenario: Existing progress data without listening history
- **WHEN** the user has progress data saved from before this feature existed (no listening history
  recorded)
- **THEN** the system loads normally without error and treats their listening history as empty, without
  discarding their existing reading or writing progress

### Requirement: Missing test data handling
The system SHALL show a clear, actionable message when a requested listening test's data file is not
present, instead of a blank page or an unhandled error.

#### Scenario: Requesting a test whose data hasn't been scraped yet
- **WHEN** the user navigates to a listening test whose JSON data file does not exist
- **THEN** the system shows a message explaining the data is unavailable and how to obtain it, rather than
  crashing or rendering an empty page
