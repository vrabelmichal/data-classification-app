import { useState, useEffect, useRef } from "react";
import { buildQuickInputString, parseQuickInput, filterQuickInput } from "./helpers";
import type { ClassificationFormState } from "./types";

export function useClassificationForm(
  currentGalaxy: any,
  existingClassification: any,
  formLocked: boolean
) {
  const [lsbClass, setLsbClass] = useState<number | null>(null);
  const [morphology, setMorphology] = useState<number | null>(null);
  const [awesomeFlag, setAwesomeFlag] = useState(false);
  const [validRedshift, setValidRedshift] = useState(false);
  const [visibleNucleus, setVisibleNucleus] = useState(false);
  const [comments, setComments] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const lastAppliedClassificationId = useRef<string | null>(null);

  // Reset form when new galaxy loads
  useEffect(() => {
    if (!currentGalaxy) return;
    setLsbClass(null);
    setMorphology(null);
    setAwesomeFlag(false);
    setValidRedshift(false);
    setVisibleNucleus(false);
    setComments("");
    setQuickInput("");
    lastAppliedClassificationId.current = null;
  }, [currentGalaxy?._id]);

  // Apply existing classification once it becomes available
  useEffect(() => {
    if (!currentGalaxy || !existingClassification) return;
    const sameGalaxy = String(existingClassification.galaxyExternalId) === String(currentGalaxy.id);
    if (!sameGalaxy) return;
    if (lastAppliedClassificationId.current === existingClassification._id) return;
    
    setLsbClass(existingClassification.lsb_class);
    setMorphology(existingClassification.morphology);
    setAwesomeFlag(existingClassification.awesome_flag);
    setValidRedshift(existingClassification.valid_redshift);
    setVisibleNucleus(existingClassification.visible_nucleus || false);
    setComments(existingClassification.comments || "");
    setQuickInput(
      buildQuickInputString(
        existingClassification.lsb_class,
        existingClassification.morphology,
        existingClassification.awesome_flag,
        existingClassification.valid_redshift,
        existingClassification.visible_nucleus || false
      )
    );
    lastAppliedClassificationId.current = existingClassification._id;
  }, [existingClassification?._id, currentGalaxy?._id]);

  const handleQuickInputChange = (value: string) => {
    const filteredValue = filterQuickInput(value);
    setQuickInput(filteredValue);
    
    const parsed = parseQuickInput(filteredValue);
    // Always set the parsed values, even if they're null or false
    // This ensures that deleting characters properly clears the form
    setLsbClass(parsed.lsbClass);
    setMorphology(parsed.morphology);
    setAwesomeFlag(parsed.awesomeFlag);
    setValidRedshift(parsed.validRedshift);
    setVisibleNucleus(parsed.visibleNucleus);
  };

  // Wrapper setters that also update quick input with the new values
  const setLsbClassAndUpdate = (value: number | null) => {
    setLsbClass(value);
    setQuickInput(buildQuickInputString(value, morphology, awesomeFlag, validRedshift, visibleNucleus));
  };

  const setMorphologyAndUpdate = (value: number | null) => {
    setMorphology(value);
    setQuickInput(buildQuickInputString(lsbClass, value, awesomeFlag, validRedshift, visibleNucleus));
  };

  const setAwesomeFlagAndUpdate = (value: boolean) => {
    setAwesomeFlag(value);
    setQuickInput(buildQuickInputString(lsbClass, morphology, value, validRedshift, visibleNucleus));
  };

  const setValidRedshiftAndUpdate = (value: boolean) => {
    setValidRedshift(value);
    setQuickInput(buildQuickInputString(lsbClass, morphology, awesomeFlag, value, visibleNucleus));
  };

  const setVisibleNucleusAndUpdate = (value: boolean) => {
    setVisibleNucleus(value);
    setQuickInput(buildQuickInputString(lsbClass, morphology, awesomeFlag, validRedshift, value));
  };

  const canSubmit = lsbClass !== null && morphology !== null;

  return {
    lsbClass,
    setLsbClass: setLsbClassAndUpdate,
    morphology,
    setMorphology: setMorphologyAndUpdate,
    awesomeFlag,
    setAwesomeFlag: setAwesomeFlagAndUpdate,
    validRedshift,
    setValidRedshift: setValidRedshiftAndUpdate,
    visibleNucleus,
    setVisibleNucleus: setVisibleNucleusAndUpdate,
    comments,
    setComments,
    quickInput,
    setQuickInput,
    quickInputRef,
    handleQuickInputChange,
    canSubmit,
  };
}
