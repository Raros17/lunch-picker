import { useState } from "react";

const OFFICE_ADDRESS = "서울특별시 강남구 역삼로7길 5";
const SEARCH_RADIUS_TEXT = "3km";

export type NearbyRestaurant = {
  id: string;
  name: string;
  categoryName: string;
  phone: string;
  address: string;
  roadAddress: string;
  distanceMeters: number;
  placeUrl: string;
};

type SearchRestaurantsResponse = {
  restaurants?: NearbyRestaurant[];
  message?: string;
};

type NearbyRestaurantSearchProps = {
  onAddRestaurant: (
    restaurantName: string,
    kakaoPlaceId: string,
    kakaoPlaceUrl: string,
  ) => Promise<void>;
};

function getDistanceText(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters.toLocaleString("ko-KR")}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export default function NearbyRestaurantSearch({
  onAddRestaurant,
}: NearbyRestaurantSearchProps) {
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingRestaurantId, setAddingRestaurantId] = useState<string | null>(
    null,
  );
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState("");

  const searchRestaurants = async (): Promise<void> => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setMessage("찾고 싶은 메뉴를 입력해주세요.");
      return;
    }

    try {
      setIsSearching(true);
      setHasSearched(true);
      setMessage("");

      const response = await fetch(
        `/api/search-restaurants?query=${encodeURIComponent(trimmedQuery)}`,
      );

      const responseBody = (await response.json()) as SearchRestaurantsResponse;

      if (!response.ok) {
        throw new Error(
          responseBody.message ?? "근처 식당 검색에 실패했습니다.",
        );
      }

      const nextRestaurants = responseBody.restaurants ?? [];

      setRestaurants(nextRestaurants);

      if (nextRestaurants.length === 0) {
        setMessage(`${SEARCH_RADIUS_TEXT} 안에서 검색 결과를 찾지 못했습니다.`);
      }
    } catch (error) {
      setRestaurants([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "근처 식당 검색에 실패했습니다.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const addRestaurant = async (restaurant: NearbyRestaurant): Promise<void> => {
    try {
      setAddingRestaurantId(restaurant.id);
      setMessage("");

      await onAddRestaurant(
        restaurant.name,
        restaurant.id,
        restaurant.placeUrl,
      );

      setMessage(`${restaurant.name}을 점심 후보에 추가했습니다.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "점심 후보 추가에 실패했습니다.",
      );
    } finally {
      setAddingRestaurantId(null);
    }
  };

  const handleQueryKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isSearching) {
      void searchRestaurants();
    }
  };

  return (
    <section className="panel restaurant-search-panel">
      <div className="restaurant-search-panel__heading">
        <div>
          <p className="restaurant-search-panel__eyebrow">NEARBY RESTAURANTS</p>

          <h2 className="restaurant-search-panel__title">근처 식당 찾기</h2>

          <p className="restaurant-search-panel__description">
            메뉴를 검색하면 회사에서 {SEARCH_RADIUS_TEXT} 안쪽의 음식점을
            거리순으로 보여줘요.
          </p>
        </div>

        <span className="restaurant-search-panel__radius">
          반경 {SEARCH_RADIUS_TEXT}
        </span>
      </div>

      <div className="restaurant-search-panel__office">
        <span className="restaurant-search-panel__office-label">기준 위치</span>

        <strong>{OFFICE_ADDRESS}</strong>
      </div>

      <div className="restaurant-search-form">
        <input
          className="restaurant-search-form__input"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={handleQueryKeyDown}
          placeholder="예: 돈가스, 쌀국수, 김치찌개"
          maxLength={30}
          disabled={isSearching}
        />

        <button
          className="restaurant-search-form__button"
          type="button"
          onClick={() => {
            void searchRestaurants();
          }}
          disabled={isSearching}
        >
          {isSearching ? "검색 중..." : "3km 내 검색"}
        </button>
      </div>

      {message && <p className="restaurant-search-panel__message">{message}</p>}

      {restaurants.length > 0 && (
        <div className="restaurant-search-results">
          {restaurants.map(restaurant => {
            const displayAddress = restaurant.roadAddress || restaurant.address;

            return (
              <article className="restaurant-search-item" key={restaurant.id}>
                <div className="restaurant-search-item__main">
                  <div className="restaurant-search-item__title-row">
                    <strong className="restaurant-search-item__name">
                      {restaurant.name}
                    </strong>

                    <span className="restaurant-search-item__distance">
                      {getDistanceText(restaurant.distanceMeters)}
                    </span>
                  </div>

                  <p className="restaurant-search-item__category">
                    {restaurant.categoryName}
                  </p>

                  <p className="restaurant-search-item__address">
                    {displayAddress}
                  </p>

                  {restaurant.phone && (
                    <p className="restaurant-search-item__phone">
                      {restaurant.phone}
                    </p>
                  )}
                </div>

                <div className="restaurant-search-item__actions">
                  <a
                    className="restaurant-search-item__map-link"
                    href={restaurant.placeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    카카오맵
                  </a>

                  <button
                    className="restaurant-search-item__add-button"
                    type="button"
                    onClick={() => {
                      void addRestaurant(restaurant);
                    }}
                    disabled={addingRestaurantId !== null}
                  >
                    {addingRestaurantId === restaurant.id
                      ? "추가 중..."
                      : "후보에 추가"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasSearched && !isSearching && restaurants.length === 0 && !message && (
        <p className="restaurant-search-panel__empty">검색 결과가 없습니다.</p>
      )}
    </section>
  );
}
