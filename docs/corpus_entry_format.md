# Format of the corpus files

## Files and file names

- All files are in the texts\ subfolder
- Only files with .txt extension are processed
- The name should have an index before the extension
- Base name is derived from the work's title, and using "_" instead of spaces
- File name uses basic ASCII characters, avoiding usually problematic characters for filesystems

## Main sections

- Two main sections
- Triple # is the separator
- Optional third section to store the original text until the final check (same separator)

```text
Lines of meta data
###
Lines of Analyzed text.
```

## Meta data

### Example

```text
Author: George Eliot (Mary Ann Evans)
Work: Middlemarch
Year: 1871–72
Choice: beginning of chapter one
Tags: Classic
Language: en
Comment: This excerpt has very long sentences.
```

### The metadata syntax
- Author: Writer's full name.
- Work: Title of the novel.
- Year: text string for the year of the writing if known ("1948", "1948-50"), if not: use the publishing year "-1950".
- Choice: what text is chosen (where it comes from in the work).
- Tags: optional; values from {Classic,Ref,ToReview,Valid,Error,Pop,amateur} and free value allowed
- Language: lower case ISO code. Example: "en" for English, or "fr/es" for French translation of Spanish original work.
- Comment: Literary interest for the entry, and maintenance note.

### Tags meaning
- Classic: The work is considered a classic (*)
- Ref: The work is considered a reference for comparison purpose (*)
- ToReview: A recent entry that might have errors and that need to be reviewed (*)
- Valid: An entry that should be completely correct (*)
- Error: An error is already identified and the entry needs a correction (*)
- Pop: Popular literary fiction (*)
- amateur: a sample of amateur's work (credit the author in the comment)

+ (*) used by the corpus entry filter

## Analyzed text

### Structure
```text
Sentence 1 on one line
# Comment to display
( beginning of then structure analysis
...
 some text of sentence 1
...
)
(
...
)
# Comment ignored

Sentence 2 on one line, after an empty line
( etc
...
)
```

### More rules
- Add a space before the sentence to mark a new paragraph in the original text

### Rules and syntax for the analyzed text
That's another document (to come)
