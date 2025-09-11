import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getImageUrl } from "../images";
import type { ImageQuality } from "../images";

export function useGalaxyImage(
  galaxyId: string | undefined,
  imageName: string,
  quality?: ImageQuality
) {
  const imageData = useQuery(
    api.images.getImageUrl,
    galaxyId ? { galaxyId, imageName, quality } : "skip"
  );

  const imageUrl = useMemo(() => {
    if (!imageData) return undefined;
    return getImageUrl(imageData.galaxyId, imageData.imageName, {
      quality: imageData.quality,
    });
  }, [imageData]);

  return {
    imageUrl,
    isLoading: imageData === undefined && galaxyId !== undefined,
    quality: imageData?.quality,
  };
}

export function useGalaxyImages(
  galaxyId: string | undefined,
  imageNames: string[],
  quality?: ImageQuality
) {
      const imagesData = useQuery(
        api.images.getGalaxyImageUrls,
        galaxyId ? { galaxyId, imageNames, quality } : "skip"
      );



    // const imageUrls = [
    //     "https://placehold.co/200?text=Masked+g-Band",
    //     "https://placehold.co/200?text=GalfitModel",
    //     "https://placehold.co/200?text=Residual",
    //     "https://placehold.co/200?text=Masked+APLpy",
    //     "https://placehold.co/200?text=APLpy",
    //     "https://placehold.co/200?text=Zoomed+out",
    // ];
    // const imagesLoading = false;

    // console.log("useGalaxyImages called with:", { galaxyId, imageNames, quality });
    // console.log(api.images.getGalaxyImageUrls);


    // return {
    //     imageUrls,
    //     isLoading: imagesLoading,
    //     quality: quality,
    // };

  const imageUrls = useMemo(() => {
    if (!imagesData) return undefined;
    console.log("imagesData", imagesData);
    return imagesData.map(data =>
      getImageUrl(data.galaxyId, data.imageName, {
        quality: data.quality,
      })
    );
  }, [imagesData]);

  return {
    imageUrls,
    isLoading: imagesData === undefined && galaxyId !== undefined,
    quality: imagesData?.[0]?.quality,
  };
}
