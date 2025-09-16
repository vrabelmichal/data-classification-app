import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ImageViewer } from "./ImageViewer";
import { cn } from "../lib/utils";
import { Link } from "react-router";
import { usePageTitle } from "../hooks/usePageTitle";
import { getImageUrl } from "../images";

type SortField = "id" | "ra" | "dec" | "reff" | "q" | "pa" | "nucleus" | "_creationTime";
type SortOrder = "asc" | "desc";
type FilterType = "all" | "my_sequence" | "classified" | "unclassified" | "skipped";

const STORAGE_KEY = "galaxyBrowserSettings";

export function GalaxyBrowser() {
  usePageTitle("Browse Galaxies");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sortBy, setSortBy] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filter, setFilter] = useState<FilterType>("all");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const didHydrateFromStorage = useRef(false);

  const galaxyData = useQuery(api.galaxies_browse.browseGalaxies, {
    page,
    pageSize,
    sortBy,
    sortOrder,
    filter,
    searchTerm: debouncedSearchTerm,
  });

  // Hydrate settings from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.pageSize && Number.isFinite(parsed.pageSize)) setPage(parsed.pageSize);
          if (parsed.page && Number.isFinite(parsed.page)) setPage(parsed.page);
          if (parsed.sortBy) setSortBy(parsed.sortBy);
          if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
          if (parsed.filter) setFilter(parsed.filter);
          if (typeof parsed.searchTerm === "string") {
            setSearchTerm(parsed.searchTerm);
            setDebouncedSearchTerm(parsed.searchTerm);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load galaxy browser settings", e);
    } finally {
      didHydrateFromStorage.current = true;
    }
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Persist settings whenever they change
  useEffect(() => {
    if (!didHydrateFromStorage.current) return; // avoid overwriting while hydrating
    const data = {
      page,
      pageSize,
      sortBy,
      sortOrder,
      filter,
      searchTerm,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save galaxy browser settings", e);
    }
  }, [page, pageSize, sortBy, sortOrder, filter, searchTerm]);

  const userPrefs = useQuery(api.users.getUserPreferences);

  // Reset to page 1 when filters change (except during initial hydration)
  useEffect(() => {
    if (!didHydrateFromStorage.current) return;
    setPage(1);
  }, [filter, sortBy, sortOrder, pageSize, debouncedSearchTerm]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "classified":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            Classified
          </span>
        );
      case "skipped":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
            Unclassified
          </span>
        );
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortOrder === "asc" ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (!galaxyData) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading galaxies...</p>
        </div>
      </div>
    );
  }

  const { galaxies, pagination } = galaxyData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galaxy Browser</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Browse and explore all galaxies in the database
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, RA, or Dec..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Galaxies</option>
              <option value="my_sequence">My Sequence</option>
              <option value="classified">Classified by Me</option>
              <option value="unclassified">Unclassified by Me</option>
              <option value="skipped">Skipped by Me</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="id">Galaxy ID</option>
              <option value="ra">Right Ascension</option>
              <option value="dec">Declination</option>
              <option value="reff">Effective Radius</option>
              <option value="q">Axis Ratio</option>
              <option value="pa">Position Angle</option>
              <option value="nucleus">Nucleus</option>
              <option value="_creationTime">Creation Time</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>

          {/* Page Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Per Page
            </label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, pagination.total)} of {pagination.total} galaxies
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Image
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("id")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Galaxy ID</span>
                    {getSortIcon("id")}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("ra")}
                >
                  <div className="flex items-center space-x-1">
                    <span>RA</span>
                    {getSortIcon("ra")}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("dec")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Dec</span>
                    {getSortIcon("dec")}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("reff")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Reff</span>
                    {getSortIcon("reff")}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("q")}
                >
                  <div className="flex items-center space-x-1">
                    <span>q</span>
                    {getSortIcon("q")}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("pa")}
                >
                  <div className="flex items-center space-x-1">
                    <span>PA</span>
                    {getSortIcon("pa")}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Classification
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {galaxies.map((galaxy: any) => (
                <tr key={galaxy._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-16 h-16">
                      <ImageViewer
                        imageUrl={getImageUrl(galaxy.id, "g_zscale_masked", { quality: userPrefs?.imageQuality || "medium" })}
                        alt={`Galaxy ${galaxy.id}`}
                        preferences={userPrefs}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {/* <Link to={`/classify/${galaxy.id}`} className="text-blue-600 dark:text-blue-400 hover:underline"> */}
                      {galaxy.id}
                    {/* </Link> */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.ra.toFixed(4)}°
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.dec.toFixed(4)}°
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.reff.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.q.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.pa.toFixed(1)}°
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(galaxy.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {galaxy.classification ? (
                      <div className="space-y-1">
                        <div>LSB: {galaxy.classification.lsb_class}</div>
                        <div>Morph: {galaxy.classification.morphology}</div>
                        <div className="flex space-x-1">
                          {galaxy.classification.awesome_flag && (
                            <span className="text-yellow-600 dark:text-yellow-400" title="Awesome">⭐</span>
                          )}
                          {galaxy.classification.valid_redshift && (
                            <span className="text-blue-600 dark:text-blue-400" title="Valid redshift">🔴</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      to={`/classify/${galaxy.id}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                    >
                      Classify
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
  {galaxies.map((galaxy: any) => (
          <div
            key={galaxy._id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start space-x-4">
              <div className="w-20 h-20 flex-shrink-0">
                <ImageViewer
                  imageUrl={getImageUrl(galaxy.id, "g_zscale_masked", { quality: userPrefs?.imageQuality || "medium" })}
                  alt={`Galaxy ${galaxy.id}`}
                  preferences={userPrefs}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {galaxy.id}
                  </h3>
                  {getStatusBadge(galaxy.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                  <div>RA: {galaxy.ra.toFixed(4)}°</div>
                  <div>Dec: {galaxy.dec.toFixed(4)}°</div>
                  <div>Reff: {galaxy.reff.toFixed(2)}</div>
                  <div>q: {galaxy.q.toFixed(3)}</div>
                  <div>PA: {galaxy.pa.toFixed(1)}°</div>
                  <div>Nucleus: {galaxy.nucleus ? "Yes" : "No"}</div>
                </div>
                
                {galaxy.classification && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center space-x-4">
                      <span>LSB: {galaxy.classification.lsb_class}</span>
                      <span>Morph: {galaxy.classification.morphology}</span>
                      {galaxy.classification.awesome_flag && (
                        <span className="text-yellow-600 dark:text-yellow-400">⭐</span>
                      )}
                      {galaxy.classification.valid_redshift && (
                        <span className="text-blue-600 dark:text-blue-400">🔴</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                to={`/classify/${galaxy.id}`}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              >
                Classify
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={!pagination.hasPrevious}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pagination.hasPrevious
                  ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              )}
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      page === pageNum
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={!pagination.hasNext}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pagination.hasNext
                  ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              )}
            >
              Next
            </button>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {pagination.totalPages}
          </div>
        </div>
      )}
    </div>
  );
}
