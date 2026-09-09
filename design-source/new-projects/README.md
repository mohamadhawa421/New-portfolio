# Images for the three new projects

Drop the twelve files here with exactly these names, then the import can run.
Any of .png / .jpg / .jpeg / .webp is fine — tell me which and I will match it
in `apps/cms/scripts/added-projects.json`.

**The cover is the brand mark, not a screenshot.** Every other project in the
portfolio uses the logo on its colour field as the card image — Tahweel's mark
on near-black, Kanz's on green — and the work grid reads as a set because of
it. A UI screenshot in that slot would make these three the odd ones out. The
screens are the case study; the mark is the cover.

    rm-luxury-cover.png     the RM monogram on black
    rm-luxury-1.png         the about section ("bien plus qu'un simple service")
    rm-luxury-2.png         the services overview ("Des services haut de gamme")
    rm-luxury-3.png         the fleet / service picker ("Choisissez le service")

    club-expert-cover.png   the club EXPER+ logo on black
    club-expert-1.png       the onboarding run of four screens
    club-expert-2.png       the news feed, article, video, empty state
    club-expert-3.png       the Produits tabs

    archlist-cover.png      the archList wordmark on navy
    archlist-1.png          the Calendrier phase timeline
    archlist-2.png          the Carnet / Objets catalogue
    archlist-3.png          the Carnet / Inspirations grid with the generator

`-1` becomes the approach shot, which sits under the approach text and has a
caption written against it, so the order above is not arbitrary:

  * RM Luxury's approach text is about photography carrying the positioning,
    and the about section is where that is clearest.
  * Club Expert+'s is about the onboarding promise, so the four-screen run.
  * Archlist's caption already reads "The phase timeline, with phases lit by
    the documents filed against them."

`-2` and `-3` become the gallery under "What shipped".

## Then

    node apps/cms/scripts/import-projects.js \
      --data apps/cms/scripts/added-projects.json \
      --images design-source/new-projects
    npm run build

Run with Strapi stopped. `make-room.js` has already been run — the three
projects exist in the CMS at orders 6, 7 and 8 with their copy; this pass only
attaches the images, so it is an update rather than a create.
