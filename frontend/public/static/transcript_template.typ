// Fill out data at the bottom, marked with TODO

#show heading.where(level: 1): it => block(above: 1.5em, below: 1em)[
  #set text(weight: "bold", size: 12pt)
  #it
]

#let oral-report-format = (report-metadata: none, c) => {
  if report-metadata == none {
    text(fill: red, weight: "extrabold", size: 5em, "NO METADATA")
    return
  }
  set document(title: report-metadata.course, author: report-metadata.author)
  set page(paper: "a4", margin: (left: 1.8cm, right: 1.8cm, top: 2cm, bottom: 2cm))
  set text(size: 12pt, lang: "en")
  set par(first-line-indent: 0pt, justify: false)
  set heading(numbering: "1.a")

  {
    set text(fill: rgb(0, 0, 128))

    text(size: 20pt)[#report-metadata.course]
    line(length: 100%, stroke: 0.5pt)

    v(0.5em)
    text(weight: "bold", size: 12pt)[Oral Exam Report]
    v(0.5em)

    table(
      columns: 2,
      stroke: none,
      column-gutter: 1.5em,
      row-gutter: 0.8em,
      [Course:], [#report-metadata.course],
      [Examiner:], [#report-metadata.examiner],
      [Protocol:], [#report-metadata.protocol],
      [Semester:], [#report-metadata.semester],
      [Exam Date:], [#report-metadata.exam-date.display()],
      [Report Date:], [#report-metadata.report-date.display()],
    )

    line(length: 100%, stroke: 0.5pt)
  }

  v(0.7cm)

  c
}

// TODO: Fill metadata

#show: oral-report-format.with(report-metadata: (
  author: "Max Mustermann",
  course: "Example Course",
  examiner: "P. Muster",
  protocol: "Max Mustermann",
  semester: "HS26",
  exam-date: datetime(year: 2026, month: 08, day: 24),
  report-date: datetime(year: 2026, month: 08, day: 28),
))


// TODO: Questions

= First question
#lorem(128)

= Second question
#lorem(128)
