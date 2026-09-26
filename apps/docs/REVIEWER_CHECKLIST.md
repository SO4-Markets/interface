# Documentation reviewer checklist

For reviewing content pull requests under `apps/docs/content/`. This checklist
is about **accuracy and reader fit**, not style — prose style is enforced by
`lint:prose` and refined in DX-053, and you should not spend review time on it.

The authoring rules are in [`CONTRIBUTING.md`](./CONTRIBUTING.md); the
information architecture and definition of done are in
[`docs/dx_1/003_content_map.md`](../../docs/dx_1/003_content_map.md).

---

## Accuracy

- [ ] **Every mechanical claim has a source.** The PR's Sources table names a
      file for each statement about how the protocol behaves. Open two or three
      of them and confirm the page matches the code, not a README summary.
- [ ] **The worked example is arithmetic, not a vibe.** The inputs, the steps,
      and the result are all shown, and the result follows from the inputs.
- [ ] **Failure modes describe real behaviour.** Where the code does not handle
      a case, the page says so plainly rather than describing the intended
      handling as if it shipped.
- [ ] **No rotting numbers.** Fees, contract addresses, and schema are not
      pasted inline — they are linked to the generated reference pages, or
      stated as "current as of <date>".
- [ ] **Links point somewhere true.** `check:links` proves the routes resolve;
      you confirm the linked page actually answers the question the link
      implies.

## Reader fit

- [ ] **One reader per page.** It is obvious from the first paragraph whether
      this is for a trader, a liquidity provider, or an integrator. A page
      serving all three serves none.
- [ ] **The first paragraph answers the title.** A reader who stops after it
      has a correct, if shallow, model.
- [ ] **Reading level matches the reader.** A concepts page for traders does
      not assume Soroban knowledge; a developers page may.
- [ ] **Adjacent concepts are linked where the reader needs them**, not dumped
      in a trailing list.

## Mechanics

- [ ] `check:content`, `check:links`, and `lint:prose` are green in CI, with no
      new prose-lint warnings.
- [ ] The page is in `content/meta.json` in content-map §2 order (or is
      `/index`, which is intentionally excluded).
- [ ] The `updated:` date is the date the work was actually finished.
- [ ] `status:` is `draft` if any claim in the PR's "Anything unverified"
      section is still open.
- [ ] For guides: the PR confirms the author performed each documented action
      on testnet.
- [ ] A `.changelog/unreleased/` entry with `area: docs` is included.

## Diagrams

- [ ] Renders in both themes.
- [ ] Has a caption that states what the diagram shows.
- [ ] Any image has non-empty alt text (`check:content` enforces this, but
      confirm the alt text is descriptive, not a filename).
