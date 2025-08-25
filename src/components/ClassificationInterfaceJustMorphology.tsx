import { useState, useEffect, useCallback, useRef } from "react";

export function ClassificationInterfaceJustMorphology() {
  const [isMobile, setIsMobile] = useState(true);
  // let isMobile = true;

  const [morphology, setMorphology] = useState<number | null>(null);
  // const [morphologyMobile, setMorphologyMobile] = useState<number | null>(lastSelectedMorphology);

    console.log("Calling the ClassificationInterface component");

  // Track screen size changes
  useEffect(() => {
    console.log("Setting up screen size listener");
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint is 1024px in Tailwind
    };

    checkScreenSize(); // Check on mount
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const morphologyOptions = [
    { value: -1, label: "Featureless [-]", color: "bg-gray-500" },
    { value: 0, label: "Not sure (Irr/other) [0]", color: "bg-yellow-500" },
    { value: 1, label: "LTG (Sp) [1]", color: "bg-blue-500" },
    { value: 2, label: "ETG (Ell) [2]", color: "bg-purple-500" },
  ];

  // Handler for morphology radio button clicks
  const handleMorphologyChange = (value: number) => {
    console.log(`Morphology changed to: ${value}`);
    setMorphology(value);
    // setMorphologyMobile(value);
  };


  let mainContentToRender;
  if (isMobile) {
    mainContentToRender = (
      <div style={{ backgroundColor: "#ffc7dcff" }}>
        <h2>MOBILE</h2>
        <h3>
          Morphology Type
        </h3>
        <div>
          {morphologyOptions.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="morphology-mobile"
                id={`radio-morphology-${option.value}`}
                value={option.value}
                checked={morphology === option.value}
                // defaultChecked={morphology === option.value}
                // checked={lastSelectedMorphology === option.value}
                onChange={() => handleMorphologyChange(option.value)}
              />
                  {option.label}  ({morphology === option.value ? "selected" : "not selected"})
                
            </label>
          ))}
        </div> 
      </div>
    );
  }
  else {
    console.log("Rendering desktop content");
    mainContentToRender = (
      <div style={{ backgroundColor: "#c7e9ffff" }}>
        <h2>DESKTOP</h2>
        <h3>
          Morphology Type
        </h3>
        <div>
          {morphologyOptions.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="morphology"
                value={option.value}
                checked={morphology === option.value}
                // checked={lastSelectedMorphology === option.value}
                onChange={() => handleMorphologyChange(option.value)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="ml-3 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
              </div>
            </label>
          ))}
          </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      
      {/* Main Content */}
      <p>Is Mobile: {isMobile ? "Yes" : "No"}; Morphology: {morphology};</p>
      {mainContentToRender}

    </div>
  );
}
