/**
 * Where a piece of content lives, marked on the element that shows it.
 *
 *   <h1 data-edit={edit('page.home.heroTitle')}>{home.heroTitle}</h1>
 *
 * In the Studio build this renders `data-edit="page.home.heroTitle"`, which is
 * how the Studio knows that clicking this heading means "that field of the
 * home page's draft". In the public build it returns `undefined`, and Astro
 * leaves an attribute whose value is undefined out entirely — so the live
 * site's HTML is byte-for-byte what it was before the Studio existed.
 * verify-build.js asserts that no data-edit reaches the public output.
 *
 * An attribute rather than a spread (`{...edit()}`), on purpose: Astro adds
 * its scoping class to any element with a spread on it, even an empty one,
 * which changed nineteen pages of the public site the first time round.
 *
 * `__STUDIO__` is replaced at build time (vite.define in astro.config.mjs).
 *
 * Keys name the draft, not the DOM, and their shape says what they are:
 *
 *   settings.<field>                      portfolio.settings.fields
 *   page.<page>.<field>                   portfolio.pages[page].fields
 *   project.<slug>                        the whole project (a card, a row)
 *   project.<slug>.<column>               portfolio.projects, one column
 *   block.<slug>.<type>.<field>           that project's block content
 *   item.<slug>.<type>.<index>.<field>    one entry of a block's items
 *   list.<list>.<index>.<field>           portfolio.lists, one entry
 *   image.<a key above that holds a media reference>
 */

declare const __STUDIO__: boolean;

export const STUDIO: boolean = typeof __STUDIO__ !== 'undefined' && __STUDIO__;

export function edit(key: string): string | undefined {
  return STUDIO ? key : undefined;
}
