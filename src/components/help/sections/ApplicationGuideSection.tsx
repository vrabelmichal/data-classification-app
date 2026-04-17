import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  ActionButtons,
  ClassificationForm,
  GalaxyInfo,
  ImageViewer,
  MobileClassificationForm,
  MobileImageSlider,
  MobileSliderControls,
  ProgressBar,
  QuickInput,
  buildQuickInputString,
  processImageLabel,
  shouldShowEllipse,
  type GalaxyData,
  type ImageType,
} from "../../classification";
import { getImageUrl } from "../../../images";
import { loadImageDisplaySettings } from "../../../images/displaySettings";
import { cn } from "../../../lib/utils";
import type { ContrastGroupEntry } from "../../../images/types";
import type { HelpFeatureFlags } from "../types";
import {
  APP_GUIDE_EXPORT_EXCLUDE_ATTR,
  APP_GUIDE_STATIC_PREVIEW_ATTR,
  exportApplicationGuideHtml,
} from "./appGuideExport";

type ApplicationGuideSectionProps = {
  appName: string;
  settings: HelpFeatureFlags;
  defaultImageQuality: "high" | "low";
};

type DocumentationExampleGalaxyResult =
  | {
      galaxy: GalaxyData;
      source: "configured" | "fallback_after_missing_configured" | "automatic";
      configuredExternalId: string | null;
    }
  | {
      galaxy: null;
      source: "configured_missing" | "none_available";
      configuredExternalId: string | null;
    }
  | undefined;

type AnchorItem = {
  id: string;
  label: string;
};

type ContrastGroupCard = {
  key: string;
  label: string;
  url: string;
  showEllipse: boolean;
  rectangle?: { x: number; y: number; width: number; height: number };
};

type ContrastGroupDocumentation = {
  id: string;
  label: string;
  description: string;
  cards: ContrastGroupCard[];
};

function resolveContrastGroupEntry(entry: ContrastGroupEntry, showMasks: boolean) {
  const key = showMasks ? entry.key_masked ?? entry.key : entry.key;
  const label = showMasks ? entry.label_masked ?? entry.label ?? key : entry.label ?? entry.label_masked ?? key;

  return {
    key,
    label,
    showEllipse: entry.showEllipse === true,
    rectangle: entry.rectangle,
    configKey: entry.key,
  };
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ExampleNotice({ result }: { result: DocumentationExampleGalaxyResult }) {
  if (!result || !result.galaxy) {
    return null;
  }

  const message =
    result.source === "configured"
      ? `Using admin-configured example galaxy ${result.galaxy.id} for the previews below.`
      : result.source === "fallback_after_missing_configured"
        ? `Configured example galaxy ${result.configuredExternalId} was not found, so the help page fell back to ${result.galaxy.id}.`
        : `Using ${result.galaxy.id}, the first non-blacklisted galaxy in the catalog, for the examples below.`;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
      {message}
    </div>
  );
}

function StaticPreviewFrame({
  title,
  subtitle,
  children,
  maxHeightClass,
  contentScale = 1,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  maxHeightClass: string;
  contentScale?: number;
}) {
  const scaledWidthPercent = `${100 / contentScale}%`;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          Static Interface Example
        </div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
          </div>
          <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
            Top portion only
          </div>
        </div>
      </div>
      <div className={cn("relative overflow-hidden", maxHeightClass)}>
        <div
          aria-hidden="true"
          className="pointer-events-none select-none origin-top-left"
          style={{
            transform: `scale(${contentScale})`,
            width: scaledWidthPercent,
          }}
        >
          {children}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-gray-900 dark:via-gray-900/95" />
      </div>
    </div>
  );
}

function FixedDesktopGalaxyImages({
  imageTypes,
  galaxy,
}: {
  imageTypes: ImageType[];
  galaxy: GalaxyData;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {imageTypes.map((imageType, index) => (
        <div
          key={imageType.url ?? `desktop-preview-slot-${index}`}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h3 className="mb-3 text-center text-sm font-medium text-gray-900 dark:text-white">
            {imageType.displayName}
          </h3>
          <div className="aspect-square">
            {imageType.url ? (
              <ImageViewer
                imageUrl={imageType.url}
                alt={`${galaxy.id} - ${imageType.name}`}
                contrast={1}
                reff={imageType.showEllipse ? galaxy.reff_pixels : undefined}
                pa={imageType.showEllipse ? galaxy.pa : undefined}
                q={imageType.showEllipse ? galaxy.q : undefined}
                x={imageType.showEllipse ? galaxy.x : undefined}
                y={imageType.showEllipse ? galaxy.y : undefined}
                rectangle={imageType.rectangle}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                No image
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopClassificationPreview({
  appName,
  galaxy,
  imageTypes,
  settings,
  captureRef,
}: {
  appName: string;
  galaxy: GalaxyData;
  imageTypes: ImageType[];
  settings: HelpFeatureFlags;
  captureRef?: React.Ref<HTMLDivElement>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lsbClass = 1;
  const morphology = 2;
  const awesomeFlag = settings.showAwesomeFlag;
  const validRedshift = settings.showValidRedshift;
  const visibleNucleus = settings.showVisibleNucleus ? galaxy.nucleus : false;
  const failedFitting = false;
  const comments = "Diffuse outer structure looks convincing; residual is clean near the center.";
  const quickInput = buildQuickInputString(
    lsbClass,
    morphology,
    awesomeFlag,
    validRedshift,
    visibleNucleus,
    failedFitting,
    settings.failedFittingMode,
    settings.showAwesomeFlag,
    settings.showValidRedshift,
    settings.showVisibleNucleus,
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div ref={captureRef} className="w-[840px] min-w-[840px] max-w-none">
        <StaticPreviewFrame
          title="Desktop Classification View"
          subtitle={`${appName} example with galaxy ${galaxy.id}`}
          maxHeightClass="max-h-[860px]"
          contentScale={0.8}
        >
          <div className="min-h-[760px] bg-gray-50 px-4 py-5 dark:bg-gray-950">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Galaxy: {galaxy.id}
                </h1>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Position: 12 of 48
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <button className="rounded-md px-3 py-1 text-sm text-gray-600 dark:text-gray-300">Mask</button>
                </div>
                <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <button className="rounded-md px-3 py-1 text-sm text-gray-600 dark:text-gray-300">r_eff</button>
                </div>
                <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <button className="rounded-md px-3 py-1 text-sm text-gray-600 dark:text-gray-300">?</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-2 space-y-6">
                <FixedDesktopGalaxyImages
                  imageTypes={imageTypes}
                  galaxy={galaxy}
                />
                <div className="flex gap-4">
                  <button className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white">Open in Aladin</button>
                  <button className="flex-1 rounded-lg bg-gray-600 px-6 py-3 font-medium text-white">View 1/5</button>
                </div>
                <GalaxyInfo
                  displayGalaxy={galaxy}
                  showAdditionalDetails={false}
                  additionalDetails={null}
                  loadingDetails={false}
                  onToggleDetails={() => {}}
                  onOpenImageUrls={() => {}}
                />
              </div>

              <div className="space-y-6">
                <QuickInput
                  value={quickInput}
                  onChange={() => {}}
                  onKeyDown={() => {}}
                  inputRef={inputRef}
                  showAwesomeFlag={settings.showAwesomeFlag}
                  showValidRedshift={settings.showValidRedshift}
                  showVisibleNucleus={settings.showVisibleNucleus}
                  failedFittingMode={settings.failedFittingMode}
                />

                <ClassificationForm
                  lsbClass={lsbClass}
                  morphology={morphology}
                  awesomeFlag={awesomeFlag}
                  validRedshift={validRedshift}
                  visibleNucleus={visibleNucleus}
                  failedFitting={failedFitting}
                  comments={comments}
                  formLocked={false}
                  displayGalaxy={galaxy}
                  failedFittingMode={settings.failedFittingMode}
                  showAwesomeFlag={settings.showAwesomeFlag}
                  showValidRedshift={settings.showValidRedshift}
                  showVisibleNucleus={settings.showVisibleNucleus}
                  onLsbClassChange={() => {}}
                  onMorphologyChange={() => {}}
                  onAwesomeFlagChange={() => {}}
                  onValidRedshiftChange={() => {}}
                  onVisibleNucleusChange={() => {}}
                  onFailedFittingChange={() => {}}
                  onCommentsChange={() => {}}
                />

                <ActionButtons
                  canSubmit={true}
                  formLocked={false}
                  navigation={{ hasPrevious: true, hasNext: true, currentIndex: 11, totalGalaxies: 48 }}
                  isOnline={true}
                  onSubmit={() => {}}
                  onSkip={() => {}}
                  onPrevious={() => {}}
                  onNext={() => {}}
                />
              </div>
            </div>

            <div className="mt-8">
              <ProgressBar
                progress={{ total: 48, classified: 10, skipped: 2, remaining: 36 }}
              />
            </div>
          </div>
        </StaticPreviewFrame>
      </div>
    </div>
  );
}

function MobileClassificationPreview({
  appName,
  galaxy,
  imageTypes,
  settings,
  currentContrastGroup,
  totalContrastGroups,
  captureRef,
}: {
  appName: string;
  galaxy: GalaxyData;
  imageTypes: ImageType[];
  settings: HelpFeatureFlags;
  currentContrastGroup: number;
  totalContrastGroups: number;
  captureRef?: React.Ref<HTMLDivElement>;
}) {
  const lsbClass = 1;
  const morphology = 2;
  const awesomeFlag = settings.showAwesomeFlag;
  const validRedshift = settings.showValidRedshift;
  const visibleNucleus = settings.showVisibleNucleus ? galaxy.nucleus : false;
  const failedFitting = false;
  const comments = "Compact note preview";

  return (
    <div ref={captureRef} className="mx-auto w-[440px] max-w-full">
      <StaticPreviewFrame
        title="Mobile Classification View"
        subtitle={`${appName} example with galaxy ${galaxy.id}`}
        maxHeightClass="max-h-[760px]"
        contentScale={0.8}
      >
        <div className="bg-gray-950 p-3">
          <div className="mx-auto w-[390px] rounded-[34px] bg-gray-950 p-2 shadow-2xl ring-1 ring-white/10">
            <div
              className="overflow-hidden rounded-[28px] bg-gray-50 dark:bg-gray-900"
              style={{ aspectRatio: "9 / 19.5" }}
            >
              <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Mobile</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Galaxy {galaxy.id}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">12 / 48</div>
                </div>
              </div>

              <div className="space-y-3 p-3">
                <MobileImageSlider
                  imageTypes={imageTypes}
                  displayGalaxy={galaxy}
                  userPrefs={null}
                  contrast={1}
                  shouldShowEllipse={(showEllipse) => shouldShowEllipse(showEllipse, true)}
                  currentIndex={0}
                  onIndexChange={() => {}}
                  renderControls={({ goPrev, goNext }) => (
                    <MobileSliderControls
                      totalImages={imageTypes.length}
                      currentContrastGroup={currentContrastGroup}
                      totalContrastGroups={totalContrastGroups}
                      onPrevImage={goPrev}
                      onNextImage={goNext}
                      onContrastClick={() => {}}
                      onAladinClick={() => {}}
                    />
                  )}
                />

                <MobileClassificationForm
                  lsbClass={lsbClass}
                  morphology={morphology}
                  awesomeFlag={awesomeFlag}
                  validRedshift={validRedshift}
                  visibleNucleus={visibleNucleus}
                  failedFitting={failedFitting}
                  comments={comments}
                  formLocked={false}
                  displayGalaxy={galaxy}
                  failedFittingMode={settings.failedFittingMode}
                  showAwesomeFlag={settings.showAwesomeFlag}
                  showValidRedshift={settings.showValidRedshift}
                  showVisibleNucleus={settings.showVisibleNucleus}
                  onLsbClassChange={() => {}}
                  onMorphologyChange={() => {}}
                  onAwesomeFlagChange={() => {}}
                  onValidRedshiftChange={() => {}}
                  onVisibleNucleusChange={() => {}}
                  onFailedFittingChange={() => {}}
                  onOpenComments={() => {}}
                />

                <ActionButtons
                  canSubmit={true}
                  formLocked={false}
                  navigation={{ hasPrevious: true, hasNext: true, currentIndex: 11, totalGalaxies: 48 }}
                  isOnline={true}
                  onSubmit={() => {}}
                  onSkip={() => {}}
                  onPrevious={() => {}}
                  onNext={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </StaticPreviewFrame>
    </div>
  );
}

function DocumentationImageCard({ card }: { card: ContrastGroupCard }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
        <img
          src={card.url}
          alt={card.label}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{card.label}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {card.showEllipse ? "Ellipse overlay available in the interface." : "No ellipse overlay in the default interface."}
      </div>
      {card.rectangle && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Includes a highlighted rectangle for the central crop region.
        </div>
      )}
    </div>
  );
}

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-gray-600 dark:text-gray-300">{children}</div>
    </section>
  );
}

function Subheading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 pt-2 text-lg font-semibold text-gray-900 dark:text-white"
    >
      {children}
    </h3>
  );
}

function MinorHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="pt-1 text-sm font-semibold uppercase tracking-[0.12em] text-gray-700 dark:text-gray-200">
      {children}
    </h4>
  );
}

function getHelpTabsHeight(): number {
  if (typeof document === "undefined") return 0;
  // HelpTabs renders with aria-label="Help sections" on the nav inside a border-b div
  const nav = document.querySelector('nav[aria-label="Help sections"]');
  return nav?.closest("div")?.getBoundingClientRect().height ?? 0;
}

function RightSideAnchors({ items }: { items: AnchorItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>(0);
  const [isPinned, setIsPinned] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fixedMetrics, setFixedMetrics] = useState<{ left: number; top: number; width: number }>({
    left: 0,
    top: 24,
    width: 0,
  });

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined") return;
    const helpTabsHeight = getHelpTabsHeight();
    const rootMarginTop = -(helpTabsHeight + 24);
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: `${rootMarginTop}px 0px -60% 0px`,
        threshold: 0,
      }
    );
    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const panel = panelRef.current;

    if (!container || !panel || typeof window === "undefined") {
      return;
    }

    const updatePosition = () => {
      const topOffset = getHelpTabsHeight() + 24;
      const nextPanelHeight = panel.offsetHeight;
      const rect = container.getBoundingClientRect();
      const shouldPin = window.innerWidth >= 1024 && rect.top <= topOffset;

      setPanelHeight((current) => (current === nextPanelHeight ? current : nextPanelHeight));
      setIsPinned((current) => (current === shouldPin ? current : shouldPin));

      if (shouldPin) {
        const nextMetrics = {
          left: rect.left,
          top: topOffset,
          width: rect.width,
        };

        setFixedMetrics((current) => {
          if (
            current.left === nextMetrics.left &&
            current.top === nextMetrics.top &&
            current.width === nextMetrics.width
          ) {
            return current;
          }

          return nextMetrics;
        });
      }
    };

    updatePosition();

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => updatePosition());
    resizeObserver.observe(container);
    resizeObserver.observe(panel);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [items]);

  return (
    <aside className="hidden self-start lg:block">
      <div ref={containerRef} className="relative" style={{ height: panelHeight || undefined }}>
      <div
        ref={panelRef}
        className="max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        style={
          isPinned
            ? {
                position: "fixed",
                top: fixedMetrics.top,
                left: fixedMetrics.left,
                width: fixedMetrics.width,
                zIndex: 20,
              }
            : undefined
        }
      >
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          On This Page
        </div>
        <nav className="space-y-2">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
      </div>
    </aside>
  );
}

export function ApplicationGuideSection({
  appName,
  settings,
  defaultImageQuality,
}: ApplicationGuideSectionProps) {
  const articleRef = useRef<HTMLDivElement | null>(null);
  const desktopPreviewRef = useRef<HTMLDivElement | null>(null);
  const mobilePreviewRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exampleGalaxyResult = useQuery(api.galaxies.help.getDocumentationExampleGalaxy) as DocumentationExampleGalaxyResult;
  const imageDisplaySettings = loadImageDisplaySettings();
  const showMasks = true;

  const documentationData = useMemo(() => {
    const galaxy = exampleGalaxyResult?.galaxy;
    if (!galaxy) {
      return null;
    }

    const contrastGroups = imageDisplaySettings.classification.contrastGroups || [];

    const groups = contrastGroups.map((group, groupIndex) => {
      const label = imageDisplaySettings.classification.groupLabels?.[groupIndex] || `Group ${groupIndex + 1}`;
      const description =
        imageDisplaySettings.classification.groupDescriptions?.[groupIndex] ||
        "This contrast group uses a different visualization strategy for the same galaxy.";

      const cards: ContrastGroupCard[] = group.map((entry) => {
        const resolved = resolveContrastGroupEntry(entry, showMasks);
        return {
          key: resolved.key,
          label: resolved.label.replace(/\n/g, " "),
          url: getImageUrl(galaxy.id, resolved.key, { quality: defaultImageQuality }),
          showEllipse: resolved.showEllipse,
          rectangle: resolved.rectangle,
        };
      });

      return {
        id: `contrast-group-${groupIndex + 1}`,
        label,
        description,
        cards,
      } satisfies ContrastGroupDocumentation;
    });

    const defaultGroupIndex = imageDisplaySettings.classification.defaultGroupIndex;
    const safeIndex =
      defaultGroupIndex >= 0 && defaultGroupIndex < contrastGroups.length
        ? defaultGroupIndex
        : 0;
    const defaultContrastGroup = contrastGroups[safeIndex] ?? [];
    const desktopImageTypes: ImageType[] = defaultContrastGroup.map((entry, index) => {
      const resolved = resolveContrastGroupEntry(entry, showMasks);
      return {
        key: resolved.key,
        configKey: resolved.configKey,
        name: resolved.label,
        displayName: processImageLabel(resolved.label),
        url: getImageUrl(galaxy.id, resolved.key, { quality: defaultImageQuality }),
        showEllipse: resolved.showEllipse,
        rectangle: resolved.rectangle,
        positionIndex: index,
      };
    });

    const mobileOrder = imageDisplaySettings.classification.defaultMobileOrder;
    const mobileImageTypes = mobileOrder && mobileOrder.length > 0
      ? mobileOrder
          .filter((index) => index >= 0 && index < desktopImageTypes.length)
          .map((index) => desktopImageTypes[index])
      : desktopImageTypes;

    return {
      galaxy,
      contrastGroups: groups,
      desktopImageTypes,
      mobileImageTypes,
      defaultGroupIndex: safeIndex,
    };
  }, [defaultImageQuality, exampleGalaxyResult, imageDisplaySettings]);

  const anchorItems = useMemo<AnchorItem[]>(() => {
    const baseItems: AnchorItem[] = [
      { id: "guide-overview", label: "Overview" },
      { id: "guide-process", label: "Classification Process" },
      { id: "guide-static-examples", label: "Interface Examples" },
      { id: "guide-images", label: "What Images Users See" },
      { id: "guide-contrast-groups", label: "Contrast Groups" },
    ];

    const groupItems = documentationData?.contrastGroups.map((group) => ({
      id: group.id,
      label: group.label,
    })) ?? [];

    return [
      ...baseItems,
      ...groupItems,
      { id: "guide-assignment", label: "Assignment Procedure" },
      { id: "guide-other-sections", label: "Other Website Sections" },
    ];
  }, [documentationData]);

  if (exampleGalaxyResult === undefined) {
    return <div className="text-sm text-gray-600 dark:text-gray-300">Loading application guide…</div>;
  }

  if (!documentationData || !documentationData.galaxy) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        No example galaxy is available for the documentation previews right now.
      </div>
    );
  }

  const { galaxy, contrastGroups, desktopImageTypes, mobileImageTypes, defaultGroupIndex } = documentationData;

  const handleExportGuide = async () => {
    if (!articleRef.current || !desktopPreviewRef.current || !mobilePreviewRef.current || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const result = await exportApplicationGuideHtml({
        appName,
        articleNode: articleRef.current,
        previewCaptures: [
          {
            key: "desktop",
            alt: `${appName} desktop classification view example`,
            node: desktopPreviewRef.current,
          },
          {
            key: "mobile",
            alt: `${appName} mobile classification view example`,
            node: mobilePreviewRef.current,
          },
        ],
      });
      if (result.warnings.length > 0) {
        toast.warning(
          `Downloaded App Guide HTML with ${result.warnings.length} placeholder image${result.warnings.length === 1 ? "" : "s"}. Some source images could not be embedded, likely because the browser could not access them.`
        );
      } else {
        toast.success("Downloaded standalone App Guide HTML.");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to export the App Guide."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
      <div ref={articleRef} className="space-y-8">
        <SectionCard id="guide-overview" title="Application Guide">
          <p>
            This guide explains how the classification web application works from a participant&apos;s point of view. It covers the <strong>review workflow</strong>, the <strong>questions users answer</strong>, the <strong>images they inspect</strong>, the <strong>contrast groups</strong> available in the interface, and the <strong>way galaxies are assigned</strong> to users.
          </p>
          <p>
            The application supports a galaxy-review workflow in which registered users inspect astronomical images and record structured judgments about each object. The goal is to make the classification process <strong>consistent</strong>, <strong>trackable</strong>, and <strong>efficient</strong> while still giving users enough visual context to make informed decisions.
          </p>
          <div>
            <p className="mb-2">In practical terms, the application helps users:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>review one galaxy at a time</strong>,</li>
              <li><strong>compare several image representations</strong> of the same object,</li>
              <li><strong>answer a small set of classification questions</strong>,</li>
              <li><strong>add flags and optional notes</strong>,</li>
              <li><strong>skip uncertain cases</strong> for later follow-up,</li>
              <li><strong>browse or revisit</strong> previously seen galaxies.</li>
            </ul>
          </div>

          <div>
            <p className="mb-2">Before a user begins regular classification, there are usually <strong>three onboarding steps</strong>:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li><strong>account creation</strong> and email confirmation,</li>
              <li><strong>administrator approval</strong>,</li>
              <li><strong>sequence preparation</strong>.</li>
            </ol>
            <p className="mt-2">Only after these steps does the main classification workflow begin.</p>
          </div>
          <ExampleNotice result={exampleGalaxyResult} />
        </SectionCard>

        <SectionCard id="guide-process" title="Classification Process">
          <Subheading>Overview</Subheading>
          <p>
            The core workflow is straightforward: the application shows one galaxy, presents several complementary image views of that target, and asks the user to record a small set of structured judgments before moving on to the next object.
          </p>
          <Subheading>What The User Is Asked To Answer</Subheading>
          <p>
            For each galaxy, the user normally provides an LSB decision, a morphology classification, optional flags such as Awesome or Visible Nucleus, and an optional comment. Experienced users can also use the quick-input field and keyboard shortcuts to work faster.
          </p>
          <p>
            More specifically, the user is usually asked to provide <strong>four things</strong>:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li><strong>an LSB classification</strong>,</li>
            <li><strong>a morphology classification</strong>,</li>
            <li><strong>zero or more additional flags</strong>,</li>
            <li><strong>optional written comments</strong>.</li>
          </ol>
          <Subheading>LSB Classification</Subheading>
          <p>
            The <strong>LSB decision</strong> tells the system whether the object should be treated as a low-surface-brightness candidate. The interface typically offers <strong>Non-LSB</strong> and <strong>LSB</strong>, and in some project configurations also includes <strong>Failed fitting</strong> either as a separate checkbox or as part of the main LSB choice.
          </p>
          <Subheading>Morphology Classification</Subheading>
          <p>
            The morphology classification gives a <strong>broad structural description</strong>. The available categories are:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Featureless</strong>,</li>
            <li><strong>Not sure (Irr/other)</strong>,</li>
            <li><strong>LTG (Sp)</strong>,</li>
            <li><strong>ETG (Ell)</strong>.</li>
          </ul>
          <p>These categories are intentionally broad so the interface stays practical for human review.</p>
          <Subheading>Flags And Comments</Subheading>
          <p>
            Depending on project settings, users may also mark additional flags such as <strong>Awesome</strong>, <strong>Valid redshift</strong>, <strong>Visible nucleus</strong>, and <strong>Failed fitting</strong>. These help highlight scientifically interesting or quality-control-relevant details without making the main form overly complicated.
          </p>
          <p>
            Users can also write <strong>optional free-text comments</strong>. This is useful for ambiguous objects, unusual visual features, or cases that may deserve follow-up later.
          </p>
          <Subheading>Submit, Skip, And Navigate</Subheading>
          <p>
            Once the user has reviewed the current galaxy, they can:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>submit</strong> the classification,</li>
            <li><strong>skip</strong> the galaxy if unsure,</li>
            <li>move to the <strong>previous</strong> or <strong>next</strong> galaxy in the sequence.</li>
          </ul>
          <p><strong>Skipped objects are not lost</strong>: they are collected in a separate section so they can be reviewed again later.</p>
          <Subheading>Quick Input Workflow</Subheading>
          <p>
            In addition to the standard form, the application includes a compact quick-input field for experienced users who want to classify rapidly using short codes and keyboard shortcuts. Users who prefer the regular form can ignore quick input entirely.
          </p>
          <p>
            The examples below show how this appears on desktop and on mobile, without the main application navigation.
          </p>
        </SectionCard>

        <SectionCard id="guide-static-examples" title="Static Interface Examples">
          <div {...{ [APP_GUIDE_STATIC_PREVIEW_ATTR]: "desktop" }}>
            <DesktopClassificationPreview
              appName={appName}
              galaxy={galaxy}
              imageTypes={desktopImageTypes}
              settings={settings}
              captureRef={desktopPreviewRef}
            />
          </div>
          <div {...{ [APP_GUIDE_STATIC_PREVIEW_ATTR]: "mobile" }}>
            <MobileClassificationPreview
              appName={appName}
              galaxy={galaxy}
              imageTypes={mobileImageTypes}
              settings={settings}
              currentContrastGroup={defaultGroupIndex}
              totalContrastGroups={contrastGroups.length}
              captureRef={mobilePreviewRef}
            />
          </div>
        </SectionCard>

        <SectionCard id="guide-images" title="What Images Users See">
          <Subheading>Six-Image Classification Layout</Subheading>
          <p>
            Each contrast group contains six images. The first three are the main analysis set: the observed band image, the residual image, and the fitted model image. The last three provide comparison and context views, usually RGB-style renderings built with APLpy-style or Lupton-style visualizations.
          </p>
          <p>
            On desktop, the layout is organized as a grid. The first three positions are especially important because they form the main analysis set: the observed single-band image, usually the g-band view; the residual image, which shows the difference between the observed data and the fitted model; and the fitted model image. The remaining three positions provide comparison images that help users judge faint structure, color context, and whether a feature is robust or only appears under a particular contrast stretch.
          </p>
          <p>
            The same galaxy is shown in every panel, but the display strategy changes. Some groups use linear scaling, some use logarithmic scaling, some use zscale-style normalization, and some mix strategies to emphasize different structures. Masked variants remove contaminants, while unmasked variants preserve full context.
          </p>
          <p>
            More explicitly, users see a combination of observed band images, residual images, fitted model images, and RGB comparison images. The observed band image is the main direct astronomical view of the target. The residual image highlights what the model fails to explain. The model image shows the fitted interpretation of the galaxy. RGB comparison images add broader visual context and can make diffuse features or neighboring structures easier to interpret.
          </p>
          <Subheading>Visualization Styles And Stretches</Subheading>
          <p>
            These images are shown with several different display strategies rather than one fixed brightness mapping. In practice, the user may encounter:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>linear scaling</strong>,</li>
            <li><strong>logarithmic scaling</strong>,</li>
            <li><strong>zscale-style normalization</strong>,</li>
            <li><strong>unified-threshold displays</strong>,</li>
            <li><strong>masked variants</strong>,</li>
            <li><strong>unmasked variants</strong>.</li>
          </ul>
          <p>
            The labels shown on the images communicate what the user is looking at: <strong>band</strong>, <strong>residual</strong>, or <strong>model</strong> role; whether the image is <strong>masked</strong>; and which visualization method or normalization is being used.
          </p>
          <p>
            This is why the interface shows multiple image versions of the same galaxy. A direct observed image shows what is actually in the data. A model image shows the fitted interpretation of that object. A residual image highlights what the model fails to explain. RGB comparison views provide broader visual context. Different stretches such as linear, logarithmic, and zscale can reveal different structures in the same galaxy. The user is therefore not looking at six copies of the same picture, but at six complementary visual products derived from the same target.
          </p>
          <Subheading>Desktop And Mobile Presentation</Subheading>
          <p>
            The same six images are available on both desktop and mobile, but the order is adapted for smaller screens. On desktop, users see the full grid at once. On mobile, the images are reordered into a swipe-friendly sequence so the most useful views appear earlier in the review flow.
          </p>
          <Subheading>Overlays, Labels, And Context</Subheading>
          <p>
            The interface can also switch between <strong>masked</strong> and <strong>unmasked</strong> image variants, and it can display an <strong>effective-radius ellipse overlay</strong> on relevant images. The image system additionally supports other visual guides, such as <strong>rectangle overlays</strong>, when a workflow needs to highlight a specific sub-region of a larger image.
          </p>
          <p>
            One useful mental model is: same galaxy, several image roles, several contrast strategies, one final human judgment. The application is designed so that users do not need to trust a single panel. Instead, they compare complementary evidence before making a decision.
          </p>
          <p>
            Alongside the images, the interface can also show supporting metadata such as identifying information and measured properties. The classification screen includes progress information as well, so users can see where they are in their assigned sequence.
          </p>
        </SectionCard>

        <SectionCard id="guide-contrast-groups" title="Contrast Groups And Current Image Sets">
          <p>
            The application currently defines {contrastGroups.length} contrast groups. Each group uses the same example galaxy but presents it with a different combination of analysis panels and comparison images. Cycling through contrast groups lets users see faint structure, model mismatch, and environmental context from different visualization angles.
          </p>
          <p>
            The gallery below shows every image in every currently configured group using the same documentation example galaxy.
          </p>
        </SectionCard>

        {contrastGroups.map((group) => (
          <SectionCard key={group.id} id={group.id} title={group.label}>
            <p>{group.description}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => (
                <DocumentationImageCard key={`${group.id}-${card.key}`} card={card} />
              ))}
            </div>
          </SectionCard>
        ))}

        <SectionCard id="guide-assignment" title="Galaxy Assignment Procedure">
          <Subheading>Overview</Subheading>
          <p>
            Users do not classify directly from the entire catalog. Instead, the system prepares a personal ordered sequence for each user. This sequence is built with a balanced assignment procedure that prefers galaxies with lower overall assignment counts, filters out blacklisted entries, respects per-user assignment limits, and can optionally fall back to already well-covered galaxies if the ideal candidate pool is too small.
          </p>
          <p>
            In practice, the sequence generator validates the requested balancing settings, checks that the user can receive a new sequence, loads the blacklist and any subset filters, scans the under-target pool first, applies the necessary candidate filters, and keeps selecting galaxies in assignment-order batches until the requested sequence is filled or the available pool is exhausted.
          </p>
          <p>
            If over-assignment is permitted and the under-target pool is too small, the system performs a second pass through galaxies already at or above the target threshold. Once selection finishes, the ordered sequence is stored for the user and the assignment counters for those galaxies are updated in follow-up batches.
          </p>

          <Subheading>General Idea</Subheading>
          <p>
            In the application, a user normally does not classify from the entire database directly. Instead, the system prepares a personal sequence: an ordered list of galaxy identifiers assigned to that user. The classification interface then walks through that sequence one galaxy at a time.
          </p>
          <p>
            When preparing a sequence for a user, the application looks for galaxies that have been assigned fewer times overall, avoids assigning a galaxy to the same user too many times, excludes blacklisted galaxies, can apply additional project filters such as paper or subset restrictions, and fills the user&apos;s sequence up to the requested size.
          </p>

          <Subheading>What The System Is Trying To Optimize</Subheading>
          <p>
            The assignment logic is designed around several goals that can compete with one another:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li><strong>spread classifications across the dataset</strong> rather than concentrating them on a few already-popular galaxies,</li>
            <li><strong>avoid repeatedly assigning the same galaxy</strong> to the same user,</li>
            <li><strong>preserve the ability to generate usable sequences</strong> even when the ideal candidate pool becomes small,</li>
            <li><strong>respect administrative exclusions and project-specific subsets</strong>,</li>
            <li><strong>keep the resulting sequence clean and ordered</strong> so the user can work through it over time.</li>
          </ol>
          <p>
            Because of this, the assignment procedure is best understood as a <strong>filtered and prioritized selection process</strong> rather than as simple random sampling.
          </p>

          <Subheading>Step-By-Step Assignment Procedure</Subheading>

          <MinorHeading>1. Validate The Request</MinorHeading>
          <p>
            The procedure starts by validating the requested assignment parameters. These include:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the <strong>expected number of participating users</strong>,</li>
            <li>the <strong>target minimum number of assignments per galaxy</strong>,</li>
            <li>the <strong>maximum number of times the same user may receive the same galaxy</strong>,</li>
            <li>the <strong>requested sequence size</strong>,</li>
            <li>whether the system may <strong>go beyond the target assignment threshold</strong> if necessary.</li>
          </ul>
          <p>If these settings are internally inconsistent, the system records <strong>warnings</strong>.</p>

          <MinorHeading>2. Check Preconditions</MinorHeading>
          <p>
            Before selecting any galaxies, the system checks whether sequence generation is even allowed. It verifies that:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the user <strong>does not already have a sequence</strong>,</li>
            <li>there is <strong>not already a sequence-generation job</strong> running for that user,</li>
            <li>the database actually <strong>contains galaxies to assign</strong>.</li>
          </ul>
          <p>At this stage, it also loads the <strong>blacklist</strong> of galaxies that should never appear in normal user sequences.</p>

          <MinorHeading>3. Create A Tracked Generation Job</MinorHeading>
          <p>
            When generation is a real assignment rather than a dry run, the system creates a tracked job record. This supports progress reporting and cancellation, so sequence generation is treated as a visible, controlled workflow rather than a hidden one-shot operation.
          </p>

          <MinorHeading>4. Start With The Under-Target Pool</MinorHeading>
          <p>
            The first selection pass focuses on galaxies whose total assignment count is still below the target threshold. This is the core of the balancing strategy. The system prefers galaxies that still need more coverage overall rather than continuing to assign galaxies that are already well represented. Within this under-target pool, galaxies are considered in ascending order of assignment count, so the least-assigned galaxies are examined first.
          </p>

          <MinorHeading>5. Filter Candidates Before Accepting Them</MinorHeading>
          <p>
            As candidate galaxies are scanned, each one must pass several filters before it is accepted. The main filters are:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Blacklist filter</strong>: blacklisted galaxies are skipped.</li>
            <li><strong>Already selected filter</strong>: galaxies already chosen earlier in the same run are skipped.</li>
            <li><strong>Project subset filter</strong>: galaxies outside the requested subset are skipped.</li>
            <li><strong>Per-user cap filter</strong>: galaxies already assigned too many times to the target user are skipped.</li>
          </ul>
          <p>Only galaxies that pass <strong>all filters</strong> are added to the sequence.</p>

          <MinorHeading>6. Continue In Batches Until Enough Galaxies Are Found</MinorHeading>
          <p>
            The generator scans the database in <strong>batches</strong> rather than trying to read everything at once. After each batch, it updates progress information, including how many galaxies have been scanned and how many valid assignments have been found.
          </p>
          <p>This makes the process:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>scalable</strong> for large datasets,</li>
            <li>compatible with <strong>cancellation</strong>,</li>
            <li>better for <strong>progress reporting</strong>.</li>
          </ul>

          <MinorHeading>7. Optionally Fall Back To The Over-Target Pool</MinorHeading>
          <p>
            If the requested sequence is not yet full and the project allows over-assignment, the generator performs a second pass through galaxies whose total assignment count is already at or above the target threshold. The same filtering rules still apply, but now the system is allowed to use higher-coverage galaxies in order to finish building the sequence. This fallback exists because a strict balancing rule can otherwise leave some users with too few galaxies to classify, especially late in a campaign or inside a tightly filtered subset. If over-assignment is disabled, the system stops after the under-target pool is exhausted.
          </p>

          <Subheading>Priority Order</Subheading>
          <p>
            In practical terms, the priority order is:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>first galaxies <strong>below the target assignment count</strong>,</li>
            <li>then, among those, galaxies with the <strong>smallest total assignment count</strong>,</li>
            <li>then a <strong>stable tie-breaking order</strong>,</li>
            <li>and only after that, if allowed, galaxies <strong>already at or above the target threshold</strong>.</li>
          </ol>

          <Subheading>Per-User Limits</Subheading>
          <p>
            The per-user assignment limit is important because total assignment count and per-user assignment count are not the same thing. A galaxy may still need more total reviews overall, but the same user should not keep receiving it indefinitely.
          </p>

          <Subheading>Blacklists And Project Filters</Subheading>
          <p>
            Some galaxies can be explicitly blacklisted from sequences. These are skipped entirely during assignment. The generator can also be restricted to a subset of galaxies, for example by a paper-related label stored in the galaxy metadata. In that case, only galaxies belonging to the requested subset are eligible.
          </p>

          <Subheading>Sequence Size, Creation, And Stored State</Subheading>
          <p>
            A user's sequence does not have to be permanent. Administrators can later extend or shorten it. Extending a sequence uses the same core logic as initial generation, but it must also exclude galaxies already present in that user's current sequence. Newly selected galaxies are appended to the end of the existing list. If a sequence is shortened, galaxies removed from the tail no longer count as pending assignments for that user, and the bookkeeping layer is adjusted accordingly.
          </p>
          <p>
            Once the selection phase is complete, the chosen galaxy identifiers are stored as the user's sequence together with the current position in that list and counters for how many items have been classified or skipped. After that, the system also updates galaxy-level assignment statistics, such as the total number of times a galaxy has been assigned and the per-user assignment count for that galaxy. These updates are performed in batches so the bookkeeping remains scalable and consistent.
          </p>

          <Subheading>Warnings, Partial Results, And Failure Cases</Subheading>
          <p>
            The assignment process is designed to report imperfect outcomes clearly. It can warn that:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>only part of the requested sequence</strong> could be generated,</li>
            <li>the <strong>under-target pool was exhausted</strong>,</li>
            <li><strong>over-target galaxies</strong> had to be used,</li>
            <li><strong>no galaxies matched</strong> the current filters.</li>
          </ul>
          <p>This distinguishes a <strong>true system failure</strong> from a <em>valid but limited result</em> caused by the available data.</p>

          <Subheading>Assignment Procedure Summary</Subheading>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-6 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
            validate requested balancing parameters
            <br />
            check that the user can receive a sequence
            <br />
            load blacklisted galaxies and active filters
            <br />
            <br />
            scan galaxies with totalAssigned &lt; target threshold
            <br />
            &nbsp;&nbsp;skip blacklisted galaxies
            <br />
            &nbsp;&nbsp;skip galaxies already selected in this run
            <br />
            &nbsp;&nbsp;skip galaxies outside the requested subset
            <br />
            &nbsp;&nbsp;skip galaxies already assigned to this user too often
            <br />
            &nbsp;&nbsp;accept remaining galaxies in ascending assignment order
            <br />
            &nbsp;&nbsp;stop when the requested sequence size is reached
            <br />
            <br />
            if sequence is still too short and over-assignment is allowed
            <br />
            &nbsp;&nbsp;scan galaxies with totalAssigned &gt;= target threshold
            <br />
            &nbsp;&nbsp;apply the same filters
            <br />
            &nbsp;&nbsp;keep filling the sequence until full or exhausted
            <br />
            <br />
            save the ordered list as the user's sequence
            <br />
            update assignment counters for the selected galaxies in batches
          </div>
        </SectionCard>

        <SectionCard id="guide-other-sections" title="Other Website Sections">
          <Subheading>Browse Galaxies</Subheading>
          <p>
            The browse section allows users to search and inspect galaxies outside the strict one-by-one classification flow. It supports filtering, sorting, preview images, and quick review of results. This is useful for exploration, checking edge cases, and looking up specific objects.
          </p>

          <Subheading>Skipped Galaxies</Subheading>
          <p>
            The skipped-galaxies section collects galaxies the user skipped during classification. It acts as a revisit queue, making it easy to return to uncertain cases later rather than losing them.
          </p>

          <Subheading>Statistics</Subheading>
          <p>
            The statistics area shows progress and performance information. Depending on user permissions and project settings, this can include personal classification statistics, project overview statistics, user-level summaries, and assignment-related statistics. This helps both individual contributors and project managers understand how work is progressing.
          </p>

          <Subheading>Notifications And Settings</Subheading>
          <p>
            The notifications area is used for project messages and workflow-related status updates. The settings area allows users to control personal preferences, including display behavior and image-quality preferences, and also includes account details and browser-local storage management.
          </p>

          <Subheading>Help, Admin, And Data Sections</Subheading>
          <p>
            The help area provides built-in guidance for getting started, classification categories and flags, keyboard shortcuts, image documentation, and this broader application guide. Administrator-only sections provide access to management tools, data-related operations, issue-report workflows, and sequence administration.
          </p>

          <Subheading>Why The Whole Site Is Structured This Way</Subheading>
          <p>
            Beyond the main classification view, the website also includes browsing tools, a skipped-galaxies revisit queue, statistics pages, notifications, user settings, and help pages. Administrative users additionally have access to data management, blacklist controls, sequence tools, and other project maintenance features.
          </p>
          <p>
            Taken together, these sections make the application more than a single image viewer: it is a complete workflow for running and monitoring a collaborative galaxy classification project.
          </p>
        </SectionCard>

        <div
          {...{ [APP_GUIDE_EXPORT_EXCLUDE_ATTR]: "true" }}
          className="flex flex-col gap-3 px-1 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            Download a standalone HTML copy of this article with guide images embedded directly in the file and the interface examples baked in as PNG snapshots.
          </p>
          <button
            type="button"
            onClick={handleExportGuide}
            disabled={isExporting}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-wait disabled:opacity-70 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {isExporting ? "Preparing download..." : "Download"}
          </button>
        </div>
      </div>

      <RightSideAnchors items={anchorItems} />
    </div>
  );
}