function ChevronIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function AgreementExplanation() {
  return (
    <details className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm open:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-800 dark:open:bg-blue-950/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <ChevronIcon />
        <span>Agreement definition and examples</span>
      </summary>

      <div className="mt-4 space-y-4 text-sm leading-6 text-gray-700 dark:text-gray-200">
        <p>
          This page now treats the classification as a decision tree instead of
          collapsing everything into one blended agreement score. The first
          question is always Is-LSB. Only after that top-level split becomes
          meaningful do the downstream morphology and flag summaries become easy
          to interpret.
        </p>

        <p>
          The key outputs are therefore explicit counts and rates such as 4/5
          Is-LSB agreement, 3/5 morphology agreement, or 2/3 visible-nucleus
          agreement. The histograms and default queries on this page are all
          built around those per-question summaries.
        </p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <p className="font-medium text-gray-900 dark:text-white">Decision-tree definition</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Is-LSB agreement only compares explicit LSB vs Non-LSB votes.
              Failed fitting is tracked separately and does not count as an
              Is-LSB answer.
            </li>
            <li>
              Morphology agreement is the dominant share among Featureless,
              Irr/other, LTG, and ETG votes for the galaxy.
            </li>
            <li>
              Visible-nucleus agreement only uses classifications where that
              question was actually answered.
            </li>
            <li>
              Failed-fitting agreement only uses classifications where the
              failed-fitting state is available, including legacy rows where it
              was encoded through the old LSB value.
            </li>
            <li>
              There is no single overall agreement score on this page anymore.
              The intent is to keep the first split, Is-LSB, separate from the
              deeper parts of the tree.
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="font-medium text-amber-900 dark:text-amber-200">Important interpretation</p>
          <p className="mt-2">
            A value like 4/5 Is-LSB agreement means exactly four of the five
            comparable Is-LSB votes landed in the same branch. It does not imply
            that morphology, visible nucleus, or failed fitting also agreed.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-medium text-gray-900 dark:text-white">Examples</p>
          <p>
            Example 1: five comparable Is-LSB votes split as LSB 4 and Non-LSB
            1. The Is-LSB agreement count is 4 and the Is-LSB agreement rate is
            80%.
          </p>
          <p>
            Example 2: the same galaxy has morphology votes ETG 3 and LTG 2.
            Morphology agreement is then 3/5, or 60%. That does not change the
            Is-LSB agreement result above; it is a deeper branch in the tree.
          </p>
          <p>
            Example 3: visible nucleus was answered by only three classifiers,
            with votes Yes, Yes, and No. Visible-nucleus agreement is therefore
            2/3, or 66.7%. The missing responses are left out of that
            denominator rather than being treated as No.
          </p>
        </div>
      </div>
    </details>
  );
}