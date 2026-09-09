# Images for the three new projects

Drop the twelve files here with exactly these names, then the import can run.
Any of .png / .jpg / .jpeg / .webp is fine — tell me which and I will match it
in `apps/cms/scripts/added-projects.json`.

    rm-luxury-cover.png     the services overview ("Des services haut de gamme")
    rm-luxury-1.png         the fleet / service picker ("Choisissez le service")
    rm-luxury-2.png         the about section ("bien plus qu'un simple service")
    rm-luxury-3.png         the RM monogram on black

    club-expert-cover.png   the onboarding run of four screens
    club-expert-1.png       the news feed, article, video, empty state
    club-expert-2.png       the Produits tabs
    club-expert-3.png       the club EXPER+ logo on black

    archlist-cover.png      the Carnet / Objets catalogue
    archlist-1.png          the Calendrier phase timeline
    archlist-2.png          the Carnet / Inspirations grid with the generator
    archlist-3.png          the archList wordmark on navy

## Then

    node apps/cms/scripts/make-room.js --from 6 --by 3
    node apps/cms/scripts/import-projects.js \
      --data apps/cms/scripts/added-projects.json \
      --images design-source/new-projects
    npm run build

Run both scripts with Strapi stopped.
