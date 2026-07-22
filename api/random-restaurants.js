const OFFICE_ADDRESS = "서울특별시 강남구 역삼로7길 5";

const RESTAURANT_CATEGORY_CODE = "FD6";
const SEARCH_RADIUS_METERS = 1000;
const SEARCH_PAGE_SIZE = 15;
const SEARCH_PAGE_COUNT = 3;

const EXCLUDED_CATEGORY_KEYWORDS = [
  "술집",
  "호프",
  "맥주",
  "와인바",
  "칵테일바",
  "포장마차",
  "유흥주점",
  "단란주점",
  "bar",
  "카페",
  "커피",
  "디저트",
  "베이커리",
  "제과",
  "제빵",
  "아이스크림",
  "케이크",
  "도넛",
  "찻집",
];

function getErrorMessage(error) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "근처 음식점 조회 중 오류가 발생했습니다.";
}

async function requestKakaoApi(url, kakaoRestApiKey) {
  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${kakaoRestApiKey}`,
    },
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      responseBody?.message ??
        responseBody?.errorType ??
        "카카오 장소 API 요청에 실패했습니다.",
    );
  }

  return responseBody;
}

async function loadOfficeCoordinates(kakaoRestApiKey) {
  const addressSearchUrl = new URL(
    "https://dapi.kakao.com/v2/local/search/address.json",
  );

  addressSearchUrl.searchParams.set("query", OFFICE_ADDRESS);

  const addressSearchResult = await requestKakaoApi(
    addressSearchUrl,
    kakaoRestApiKey,
  );

  const officeDocument = addressSearchResult.documents?.[0];

  if (!officeDocument) {
    throw new Error("회사 주소의 좌표를 찾지 못했습니다.");
  }

  return {
    longitude: officeDocument.x,
    latitude: officeDocument.y,
  };
}

async function loadRestaurantPage(kakaoRestApiKey, officeCoordinates, page) {
  const categorySearchUrl = new URL(
    "https://dapi.kakao.com/v2/local/search/category.json",
  );

  categorySearchUrl.searchParams.set(
    "category_group_code",
    RESTAURANT_CATEGORY_CODE,
  );

  categorySearchUrl.searchParams.set("x", officeCoordinates.longitude);

  categorySearchUrl.searchParams.set("y", officeCoordinates.latitude);

  categorySearchUrl.searchParams.set("radius", String(SEARCH_RADIUS_METERS));

  categorySearchUrl.searchParams.set("sort", "distance");

  categorySearchUrl.searchParams.set("size", String(SEARCH_PAGE_SIZE));

  categorySearchUrl.searchParams.set("page", String(page));

  return requestKakaoApi(categorySearchUrl, kakaoRestApiKey);
}

function shouldExcludeRestaurant(restaurantDocument) {
  const searchableText = `${restaurantDocument.place_name ?? ""} ${
    restaurantDocument.category_name ?? ""
  }`.toLowerCase();

  return EXCLUDED_CATEGORY_KEYWORDS.some(excludedKeyword =>
    searchableText.includes(excludedKeyword.toLowerCase()),
  );
}

function convertRestaurantDocument(restaurantDocument) {
  return {
    id: restaurantDocument.id,
    name: restaurantDocument.place_name,
    categoryName: restaurantDocument.category_name,
    phone: restaurantDocument.phone ?? "",
    address: restaurantDocument.address_name ?? "",
    roadAddress: restaurantDocument.road_address_name ?? "",
    distanceMeters: Number(restaurantDocument.distance) || 0,
    placeUrl: restaurantDocument.place_url ?? "",
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      message: "GET 요청만 사용할 수 있습니다.",
    });
  }

  const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

  if (!kakaoRestApiKey) {
    return response.status(500).json({
      message: "KAKAO_REST_API_KEY 환경변수가 없습니다.",
    });
  }

  try {
    const officeCoordinates = await loadOfficeCoordinates(kakaoRestApiKey);

    const pageNumbers = Array.from(
      {
        length: SEARCH_PAGE_COUNT,
      },
      (_, pageIndex) => pageIndex + 1,
    );

    const pageResults = await Promise.all(
      pageNumbers.map(pageNumber =>
        loadRestaurantPage(kakaoRestApiKey, officeCoordinates, pageNumber),
      ),
    );

    const restaurantDocuments = pageResults.flatMap(
      pageResult => pageResult.documents ?? [],
    );

    const restaurantMap = new Map();

    restaurantDocuments.forEach(restaurantDocument => {
      if (
        !restaurantDocument.id ||
        !restaurantDocument.place_name ||
        !restaurantDocument.place_url ||
        shouldExcludeRestaurant(restaurantDocument)
      ) {
        return;
      }

      restaurantMap.set(
        restaurantDocument.id,
        convertRestaurantDocument(restaurantDocument),
      );
    });

    const restaurants = Array.from(restaurantMap.values()).sort(
      (firstRestaurant, secondRestaurant) =>
        firstRestaurant.distanceMeters - secondRestaurant.distanceMeters,
    );

    response.setHeader(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400",
    );

    return response.status(200).json({
      officeAddress: OFFICE_ADDRESS,
      radiusMeters: SEARCH_RADIUS_METERS,
      restaurants,
    });
  } catch (error) {
    console.error("랜덤 음식점 후보 조회 실패:", error);

    return response.status(500).json({
      message: getErrorMessage(error),
    });
  }
}
