-- ============================================================
-- Fix seeded portfolio_links field name.
-- ============================================================
--
-- The demo seed wrote each portfolio link as {label, url}. The app reads
-- {title, url} -- see the PortfolioLink type in settings/portfolio-links.tsx
-- and Profile.portfolio_links in src/types/database.ts.
--
-- Consequences on the profile screen: every link rendered with a blank name,
-- and because the list was keyed on item.title, every key was undefined at
-- once, producing React's "each child should have a unique key prop" warning.
--
-- Renames the key in place, leaving any correctly-shaped rows untouched.
-- ============================================================

UPDATE public.profiles
   SET portfolio_links = (
     SELECT jsonb_agg(
              CASE
                WHEN link ? 'label' AND NOT (link ? 'title')
                  THEN (link - 'label') || jsonb_build_object('title', link -> 'label')
                ELSE link
              END
              ORDER BY idx
            )
       FROM jsonb_array_elements(portfolio_links) WITH ORDINALITY AS t(link, idx)
   )
 WHERE portfolio_links @> '[{"label": null}]'::jsonb
    OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(portfolio_links) AS l(link)
          WHERE link ? 'label' AND NOT (link ? 'title')
       );
