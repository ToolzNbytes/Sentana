# Syntax and rules for the notation of the sentence's structure (v4)

## General rules

- All text is enclosed by ( ) and tagged by a two-letter code after the opening.
- Enclosing can contain other enclosings, either with ( ) or [ ], depending on the type of tag.
- All the characters of the original sentence are preserved, including spaces.
- No character is added, even spaces, with the one exception of the leading space after the first tag of the structure, for readability (it can also be present in the original sentence as a paragraph marker, in which case nothing is added).
- There is no overall enclosing for the whole structure, the root item being implicit, so we can have multiple ( ) starting and closing at first level of nesting (no leading tilde), one after another.
- There is an important distinction between the idea of level, for nesting with ( ), and the addition of [ ] enclosures inside ( ) that don't do nesting and don't increase the level.
- Each line has its nesting level N represented by N-1 leading tildes '~'.
- No line ends with a space character.
- Closing an enclosure of ( ) or [ ] is done on its own line without anything else besides tildes and the closing sign.
- The level of a closing line is the same as the opening (as many tildes)
- The level of opening a ( ) enclosing is either one more than the previous line, or the same if the previous line is a closing ( ).
- The level of opening a [ ] enclosing is either the same than the previous line, or one less if the previous line is a closing ( ).
- The level of a line without opening or closing, for a continuation text, is one less than the closing line it follows.
- The starting level of the structure is 1, so no tilde at the beginning, only the opening of ( ).
- There is no empty line.
- A tag opening can have no original text (empty opening), when the clause starts with a subclause (next line) doing a forward reference.
- The comment lines before or after the structure itself start with '#'.
- No comment within the structure itself.
- Original sentences starting with parenthesis are not supported, add a dash '-' character before (suggested character).

## Tag list and meaning

- IC: Independent Clause, for a the backbone of a well-formed sentence.
- FG: Fragment, for a standalone piece of sentence that misses a verb or a subject (or both).
- DC: Dependent Clause, the usual grammatical meaning.
- PP: Participial Phrase or similar (being optional in the sentence), in short it's with -ing or -ed verbs and can be removed without breaking the sentence.
- CP: Compound Predicate or coordinated parallel constituent, when the same kind and level of content is added using the subject (most of the time) of the current clause as a common factor (not repeating it).
- AD: other Adjunct Phrase (optional in the sentence for its structure), a catch-them-all additional part.
- AT: Attribution to a speaker, for the dialogues line type of sentence.

## Non-nesting tags

- CP is a non-nesting tag which exclusively uses [ ] for its enclosing.
- (No other tag as of now for v4.)

## Syntax for opening
- Start with the proper number of tildes
- Open sign of the enclosing
- Tag name, upper case
- Number:index of the opening (called id), starting from 1, increment by one throught the structure at each enclosure opening.
- Mandatory addition for some tags
- Beginning of the original text being enclosed: Space or eligible character as space, such as em-dash
- Rest of the enclosed original text.
- Example with a nesting tag XX:
```
~~(XX phrase
```

### Tag additions for DC, PP, AP (mandatory)
- After the id of the tag: '<' or '>', followed by the id of the refered tag.
- '<' is for the backward reference, the usual.
- '>' is for the case of forward reference, each time the subject refered by the clause appears later in the upper clause.
```
~(DC3<2 phrase
```


### Tag addition for the IC, FG (optional)
- After the id of the tag: '@', followed by an index mentioned in the comment for who is talking, or 0 if unknown.

## Special comments

- Comment with "#@1: Name" means the character no 1 is "Name", which can be used in @ id later on.

## Constraints
- The first line is either a IC or a FG opening.
- After closing a level 1 enclosure (now virtually at level 0), the structure can end, or start a new IC or FG opening.
- IC and FG are always level 1, unless marked as dialogue by a '@' addition, for quoted-like insertions.
- There is no case of two consecutive continuation texts (lines with no tag), as a closing is always required before. A continuation line has one level less than the previous line if it's a closing ( ), and the same level if it's a closing [ ].
- A CP cannot carry the first text of its level, the nearest previous non-closing line of the same level (and before reaching a lower level) must have some text.

## Derived rules and contraints for the structure wizard
- In this context the closings are implicit, automatically handled at checkout time for a verification pass.
- Here, a 'line' is a line of the wizard table, not a line of the structure.
- Tag '--' means a continuation line for the wizard.
- A line L1 of level N1 is 'stacked' below another line L2 of level N2, with N2 strictly inferior to N1, if L2 is the nearest line of level N2 before L1.

### Wizard constraints
- First line is level 1
- Level 1 lines can only have tags 'IC' or 'FG'
- A '--' tag line following another '--' tag line must have a strictly lower level.
- A 'IC' or 'FG' tag line of level 2 or above must have the 'Dialogue' property.
- A 'AT' tag for a line is only available if the whole sentence is marked 'Dialogue' or if it is stacked below a IC or a FG marked as 'Dialogue'.
- A 'CP' tag line cannot carry the first text of a level: the nearest line of the same level before must have its own text not empty.

### Wizard initiatives
- Tagging a level 1 line another tag than 'IC' or 'FG' will increase its level by 1, and if it's the first line, then an empty text 'IC' line is inserted before at level 1 and the line is marked as 'forward'.
