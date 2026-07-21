const OFFICE_ADDRESS = "서울특별시 강남구 역삼로7길 5";

const SEARCH_RADIUS_METERS = 3000;
const SEARCH_RESULT_LIMIT = 15;

let cachedOfficeCoordinates = null;

function createJsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function getOfficeCoordinates(restApiKey) {
  if (cachedOfficeCoordinates) {
    return cachedOfficeCoordinates;
  }

  const addressSearchUrl = new URL(
    "https://dapi.kakao.com/v2/local/search/address.json",
  );

  addressSearchUrl.searchParams.set("query", OFFICE_ADDRESS);

  const addressResponse = await fetch(addressSearchUrl, {
    headers: {
      Authorization: `KakaoAK ${restApiKey}`,
    },
  });

  if (!addressResponse.ok) {
    const errorText = await addressResponse.text();

    console.error("카카오 주소 검색 실패:", addressResponse.status, errorText);

    throw new Error(
      `카카오 주소 검색 실패 (${addressResponse.status}): ${errorText}`,
    );
  }

  const addressBody = await addressResponse.json();
  const addressDocument = addressBody.documents?.[0];

  if (!addressDocument?.x || !addressDocument?.y) {
    throw new Error("등록된 회사 주소의 좌표를 찾지 못했습니다.");
  }

  cachedOfficeCoordinates = {
    longitude: addressDocument.x,
    latitude: addressDocument.y,
  };

  return cachedOfficeCoordinates;
}

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return createJsonResponse(
        {
          message: "GET 요청만 사용할 수 있습니다.",
        },
        405,
      );
    }

    const restApiKey = process.env.KAKAO_REST_API_KEY;

    if (!restApiKey) {
      return createJsonResponse(
        {
          message: "Vercel에 KAKAO_REST_API_KEY가 등록되지 않았습니다.",
        },
        500,
      );
    }

    const requestUrl = new URL(request.url);
    const query = requestUrl.searchParams.get("query")?.trim() ?? "";

    if (!query) {
      return createJsonResponse(
        {
          message: "검색할 메뉴를 입력해주세요.",
        },
        400,
      );
    }

    if (query.length > 30) {
      return createJsonResponse(
        {
          message: "검색어는 30자 이내로 입력해주세요.",
        },
        400,
      );
    }

    try {
      const officeCoordinates = await getOfficeCoordinates(restApiKey);

      const keywordSearchUrl = new URL(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
      );

      keywordSearchUrl.searchParams.set("query", query);
      keywordSearchUrl.searchParams.set("x", officeCoordinates.longitude);
      keywordSearchUrl.searchParams.set("y", officeCoordinates.latitude);
      keywordSearchUrl.searchParams.set("radius", String(SEARCH_RADIUS_METERS));
      keywordSearchUrl.searchParams.set("category_group_code", "FD6");
      keywordSearchUrl.searchParams.set("sort", "distance");
      keywordSearchUrl.searchParams.set("size", String(SEARCH_RESULT_LIMIT));

      const keywordResponse = await fetch(keywordSearchUrl, {
        headers: {
          Authorization: `KakaoAK ${restApiKey}`,
        },
      });

      if (!keywordResponse.ok) {
        const errorBody = await keywordResponse.text();

        console.error(
          "카카오 장소 검색 실패:",
          keywordResponse.status,
          errorBody,
        );

        throw new Error("카카오에서 식당 정보를 불러오지 못했습니다.");
      }

      const keywordBody = await keywordResponse.json();

      const restaurants = (keywordBody.documents ?? [])
        .map(document => ({
          id: document.id,
          name: document.place_name,
          categoryName: document.category_name,
          phone: document.phone,
          address: document.address_name,
          roadAddress: document.road_address_name,
          distanceMeters: Number(document.distance || 0),
          placeUrl: document.place_url,
        }))
        .filter(
          restaurant => restaurant.distanceMeters <= SEARCH_RADIUS_METERS,
        );

      return createJsonResponse({
        officeAddress: OFFICE_ADDRESS,
        radiusMeters: SEARCH_RADIUS_METERS,
        restaurants,
      });
    } catch (error) {
      console.error("근처 식당 검색 오류:", error);

      return createJsonResponse(
        {
          message:
            error instanceof Error
              ? error.message
              : "근처 식당 검색에 실패했습니다.",
        },
        500,
      );
    }
  },
};
