export function AgreementExplanation() {
  return (
    <details className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm open:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-800 dark:open:bg-blue-950/10">
      <summary className="cursor-pointer list-none text-lg font-semibold text-gray-900 dark:text-white">
        Agreement definition and examples
      </summary>

      <div className="mt-4 space-y-4 text-sm leading-6 text-gray-700 dark:text-gray-200">
        <p>
          Agreement on this page is a per-galaxy score built from five tracked
          classification dimensions: LSB, morphology, awesome flag,
          valid-redshift flag, and visible-nucleus flag. It does not include the
          catalog metadata such as paper, coordinates, catalog nucleus, comments,
          time spent, or the classification ID itself.
        </p>

        <p>
          For each galaxy, the analysis first looks at one field at a time and
          asks: what fraction of classifications landed in the dominant answer
          bucket for that field? Then it averages those five dominant shares.
        </p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <p className="font-medium text-gray-900 dark:text-white">Field-by-field definition</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              LSB agreement = dominant share among Failed fitting, Non-LSB, and
              LSB votes. Failed fitting is treated as its own LSB bucket.
            </li>
            <li>
              Morphology agreement = dominant share among Featureless,
              Irr/other, LTG, and ETG votes.
            </li>
            <li>
              Awesome agreement = dominant share between checked and unchecked.
            </li>
            <li>
              Valid-redshift agreement = dominant share between checked and
              unchecked.
            </li>
            <li>
              Visible-nucleus agreement = dominant share between checked and
              unchecked.
            </li>
            <li>
              Overall agreement = average of those five field agreements.
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="font-medium text-amber-900 dark:text-amber-200">Important interpretation</p>
          <p className="mt-2">
            An 80% agreement score does not mean that 80% of users submitted the
            exact same full classification record. It means that, after checking
            each field independently, the average dominant share across the five
            tracked fields is 80%.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-medium text-gray-900 dark:text-white">What 100% means</p>
          <p>
            100% agreement means every tracked field matched perfectly across all
            classifications for that galaxy. Every user chose the same LSB
            answer, the same morphology answer, and the same checked or unchecked
            state for awesome, valid redshift, and visible nucleus.
          </p>

          <p className="font-medium text-gray-900 dark:text-white">What roughly 80% means</p>
          <p>
            Around 80% means the galaxy is mostly consistent, but at least one
            field is split. Example with five classifications: suppose everyone
            agrees on LSB, morphology, valid redshift, and visible nucleus, but
            the awesome flag splits 3 vs 2. The field scores are 100%, 100%,
            60%, 100%, and 100%, so the overall agreement becomes 92%.
          </p>
          <p>
            To get closer to 80%, you usually need disagreement in more than one
            field. Example: LSB 4/5, morphology 4/5, awesome 3/5, valid
            redshift 4/5, visible nucleus 5/5. That averages to 80%.
          </p>

          <p className="font-medium text-gray-900 dark:text-white">What roughly 50% means</p>
          <p>
            Around 50% means the classifications are heavily split. With four
            users, a 2 vs 2 split on a binary flag gives 50% for that field.
            With morphology, a 1/1/1/1 split also gives 25% on that field. A
            galaxy near 50% usually means there is no stable consensus and the
            users disagree on multiple aspects of the object.
          </p>

          <p className="font-medium text-gray-900 dark:text-white">Why two galaxies with the same score can still differ</p>
          <p>
            Because the score is an average, two galaxies can both show 80%
            agreement for different reasons. One may have perfect agreement on
            four fields and a sharp split on one flag. Another may show mild
            disagreement across several fields. That is why the example cards now
            expose the first few individual votes and the modal shows the full
            classification table.
          </p>
        </div>
      </div>
    </details>
  );
}