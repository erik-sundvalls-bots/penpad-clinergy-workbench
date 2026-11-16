# Validation cross-check

ehrtslib 0.12.0 (`validateFlatPayload` and `RMSpecificationValidator`) accepts the demo composition: no flat errors and no RM specification errors.

`InvariantEvaluator.validateInvariants` throws `TypeError: invariants is not iterable` before it looks at the composition. That is inside ehrtslib 0.12.0. It did not report an invariant failure in this data.

EHRbase was not run. This environment has no Docker, so the OPT was not uploaded and the composition was not posted.

Archie was not run. Java 21 is installed, Maven is not, and the Archie ADL validator was not assembled. The RM specification check above is the check that did run.

Nothing in the generated demo composition was shown to be invalid by the checks that completed.
