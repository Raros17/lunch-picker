import { useEffect, useState } from "react";

import "./RandomRestaurantPicker.css";

import RestaurantCommentsButton from "./RestaurantCommentsButton";

import { loadRestaurantCommentCounts } from "../lib/restaurantComments";

import {
  confirmRandomRestaurantLunch,
  loadRecentlyEatenRestaurantPlaceIds,
} from "../lib/randomRestaurantLunch";

export type RandomRestaurant = {
  id: string;
  name: string;
  categoryName: string;
  phone: string;
  address: string;
  roadAddress: string;
  distanceMeters: number;
  placeUrl: string;
};

type RandomRestaurantsResponse = {
  officeAddress?: string;
  radiusMeters?: number;
  restaurants?: RandomRestaurant[];
  message?: string;
};

type RandomRestaurantPickerProps = {
  onAddRestaurant: (
    restaurantName: string,
    kakaoPlaceId: string,
    kakaoPlaceUrl: string,
  ) => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "랜덤 음식점 선택 중 오류가 발생했습니다.";
}

function getDistanceText(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters.toLocaleString("ko-KR")}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function getShortCategoryName(categoryName: string): string {
  const categoryParts = categoryName
    .split(">")
    .map(categoryPart => categoryPart.trim())
    .filter(Boolean);

  return categoryParts[categoryParts.length - 1] ?? "음식점";
}

function getDistanceWeight(distanceMeters: number): number {
  if (distanceMeters <= 400) {
    return 3;
  }

  if (distanceMeters <= 700) {
    return 2;
  }

  return 1;
}

function pickWeightedRestaurant(
  restaurants: RandomRestaurant[],
): RandomRestaurant {
  const totalWeight = restaurants.reduce(
    (weightSum, restaurant) =>
      weightSum + getDistanceWeight(restaurant.distanceMeters),
    0,
  );

  let randomWeight = Math.random() * totalWeight;

  for (const restaurant of restaurants) {
    randomWeight -= getDistanceWeight(restaurant.distanceMeters);

    if (randomWeight <= 0) {
      return restaurant;
    }
  }

  return restaurants[restaurants.length - 1];
}

export default function RandomRestaurantPicker({
  onAddRestaurant,
}: RandomRestaurantPickerProps) {
  const [restaurantPool, setRestaurantPool] = useState<RandomRestaurant[]>([]);

  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RandomRestaurant | null>(null);

  const [seenRestaurantIds, setSeenRestaurantIds] = useState<string[]>([]);

  const [excludedRestaurantIds, setExcludedRestaurantIds] = useState<string[]>(
    [],
  );

  const [commentCount, setCommentCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  const [isAdding, setIsAdding] = useState(false);

  const [isConfirming, setIsConfirming] = useState(false);

  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedRestaurant) {
      setCommentCount(0);
      return;
    }

    let isCancelled = false;

    const loadCommentCount = async (): Promise<void> => {
      try {
        const commentCounts = await loadRestaurantCommentCounts([
          selectedRestaurant.id,
        ]);

        if (!isCancelled) {
          setCommentCount(commentCounts[selectedRestaurant.id] ?? 0);
        }
      } catch (error) {
        console.error("랜덤 식당 한줄평 개수 조회 실패:", error);
      }
    };

    setCommentCount(0);

    void loadCommentCount();

    return () => {
      isCancelled = true;
    };
  }, [selectedRestaurant]);

  const chooseRestaurantFromPool = (
    availablePool: RandomRestaurant[],

    previousSeenRestaurantIds: string[],
  ): void => {
    const excludedIdSet = new Set(excludedRestaurantIds);

    const seenIdSet = new Set(previousSeenRestaurantIds);

    const baseCandidates = availablePool.filter(
      restaurant => !excludedIdSet.has(restaurant.id),
    );

    let nextCandidates = baseCandidates.filter(
      restaurant => !seenIdSet.has(restaurant.id),
    );

    let nextSeenRestaurantIds = previousSeenRestaurantIds;

    if (nextCandidates.length === 0) {
      nextCandidates = baseCandidates;

      nextSeenRestaurantIds = [];
    }

    if (nextCandidates.length === 0) {
      throw new Error("최근 14일 안에 먹지 않은 음식점이 없습니다.");
    }

    const nextRestaurant = pickWeightedRestaurant(nextCandidates);

    setSelectedRestaurant(nextRestaurant);

    setSeenRestaurantIds([...nextSeenRestaurantIds, nextRestaurant.id]);

    setMessage("");
  };

  const loadRestaurantPool = async (): Promise<{
    restaurants: RandomRestaurant[];
    recentlyEatenPlaceIds: string[];
  }> => {
    const [restaurantResponse, recentlyEatenPlaceIds] = await Promise.all([
      fetch("/api/random-restaurants"),

      loadRecentlyEatenRestaurantPlaceIds(),
    ]);

    const restaurantResponseBody =
      (await restaurantResponse.json()) as RandomRestaurantsResponse;

    if (!restaurantResponse.ok) {
      throw new Error(
        restaurantResponseBody.message ??
          "근처 음식점 후보를 불러오지 못했습니다.",
      );
    }

    return {
      restaurants: restaurantResponseBody.restaurants ?? [],

      recentlyEatenPlaceIds,
    };
  };

  const drawRandomRestaurant = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setMessage("");

      if (restaurantPool.length === 0) {
        const { restaurants, recentlyEatenPlaceIds } =
          await loadRestaurantPool();

        if (restaurants.length === 0) {
          throw new Error("반경 1km 안에서 랜덤 후보를 찾지 못했습니다.");
        }

        setRestaurantPool(restaurants);

        setExcludedRestaurantIds(recentlyEatenPlaceIds);

        const recentlyEatenIdSet = new Set(recentlyEatenPlaceIds);

        const firstCandidates = restaurants.filter(
          restaurant => !recentlyEatenIdSet.has(restaurant.id),
        );

        if (firstCandidates.length === 0) {
          throw new Error("최근 14일 안에 먹지 않은 음식점이 없습니다.");
        }

        const firstRestaurant = pickWeightedRestaurant(firstCandidates);

        setSelectedRestaurant(firstRestaurant);

        setSeenRestaurantIds([firstRestaurant.id]);

        return;
      }

      chooseRestaurantFromPool(restaurantPool, seenRestaurantIds);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const addSelectedRestaurant = async (): Promise<void> => {
    if (!selectedRestaurant) {
      return;
    }

    try {
      setIsAdding(true);
      setMessage("");

      await onAddRestaurant(
        selectedRestaurant.name,
        selectedRestaurant.id,
        selectedRestaurant.placeUrl,
      );

      setMessage(`${selectedRestaurant.name}을 점심 후보에 추가했습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  };

  const confirmSelectedRestaurant = async (): Promise<void> => {
    if (!selectedRestaurant) {
      return;
    }

    const shouldConfirm = window.confirm(
      `${selectedRestaurant.name}을 오늘 점심으로 결정할까요?\n현재 후보는 모두 비워지고 나머지는 과거 메뉴로 이동합니다.`,
    );

    if (!shouldConfirm) {
      return;
    }

    try {
      setIsConfirming(true);
      setMessage("");

      await confirmRandomRestaurantLunch({
        name: selectedRestaurant.name,

        kakaoPlaceId: selectedRestaurant.id,

        kakaoPlaceUrl: selectedRestaurant.placeUrl,
      });

      setExcludedRestaurantIds(previousExcludedIds => [
        ...new Set([...previousExcludedIds, selectedRestaurant.id]),
      ]);

      setRestaurantPool(previousRestaurantPool =>
        previousRestaurantPool.filter(
          restaurant => restaurant.id !== selectedRestaurant.id,
        ),
      );

      setMessage(`${selectedRestaurant.name}을 오늘 점심으로 기록했습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsConfirming(false);
    }
  };

  const displayAddress =
    selectedRestaurant?.roadAddress || selectedRestaurant?.address || "";

  return (
    <section className="panel random-restaurant-panel">
      <div className="random-restaurant-panel__heading">
        <div>
          <p className="random-restaurant-panel__eyebrow">LAZY LUNCH PICK</p>

          <h2 className="random-restaurant-panel__title">아무거나 골라줘</h2>

          <p className="random-restaurant-panel__description">
            반경 1km 내 음식점 중 최근 14일 안에 먹은 곳을 빼고 하나만 뽑아요.
          </p>
        </div>

        <span className="random-restaurant-panel__badge">🎲 1km</span>
      </div>

      {!selectedRestaurant ? (
        <button
          className="random-restaurant-panel__draw-button"
          type="button"
          onClick={() => {
            void drawRandomRestaurant();
          }}
          disabled={isLoading}
        >
          <span>
            {isLoading ? "근처 식당 찾는 중..." : "생각하기도 귀찮다"}
          </span>

          <strong>{isLoading ? "잠깐만" : "랜덤 뽑기"}</strong>
        </button>
      ) : (
        <div className="random-restaurant-result">
          <div className="random-restaurant-result__label">오늘 여기 어때</div>

          <div className="random-restaurant-result__main">
            <div>
              <h3 className="random-restaurant-result__name">
                {selectedRestaurant.name}
              </h3>

              <p className="random-restaurant-result__meta">
                <span>
                  {getShortCategoryName(selectedRestaurant.categoryName)}
                </span>

                <span aria-hidden="true">·</span>

                <strong>
                  {getDistanceText(selectedRestaurant.distanceMeters)}
                </strong>
              </p>

              {displayAddress && (
                <p className="random-restaurant-result__address">
                  {displayAddress}
                </p>
              )}

              {selectedRestaurant.phone && (
                <p className="random-restaurant-result__phone">
                  {selectedRestaurant.phone}
                </p>
              )}
            </div>

            <div className="random-restaurant-result__dice">🎲</div>
          </div>

          <div className="random-restaurant-result__actions">
            <RestaurantCommentsButton
              kakaoPlaceId={selectedRestaurant.id}
              placeName={selectedRestaurant.name}
              commentCount={commentCount}
              onCommentCountChange={(nextCommentCount: number) => {
                setCommentCount(nextCommentCount);
              }}
            />

            <a
              className="random-restaurant-result__map-button"
              href={selectedRestaurant.placeUrl}
              target="_blank"
              rel="noreferrer"
            >
              카카오맵
            </a>

            <button
              className="random-restaurant-result__add-button"
              type="button"
              onClick={() => {
                void addSelectedRestaurant();
              }}
              disabled={isAdding || isConfirming}
            >
              {isAdding ? "추가 중..." : "후보에 추가"}
            </button>

            <button
              className="random-restaurant-result__confirm-button"
              type="button"
              onClick={() => {
                void confirmSelectedRestaurant();
              }}
              disabled={isAdding || isConfirming}
            >
              {isConfirming ? "기록 중..." : "오늘 메뉴로 결정"}
            </button>
          </div>

          <button
            className="random-restaurant-result__retry-button"
            type="button"
            onClick={() => {
              void drawRandomRestaurant();
            }}
            disabled={isLoading || isAdding || isConfirming}
          >
            {isLoading ? "다시 뽑는 중..." : "다시 뽑기"}
          </button>
        </div>
      )}

      {message && <p className="random-restaurant-panel__message">{message}</p>}
    </section>
  );
}
