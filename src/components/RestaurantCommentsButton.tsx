import { useEffect, useId, useMemo, useState } from "react";

import { createPortal } from "react-dom";

import "./RestaurantCommentsButton.css";

import {
  deleteRestaurantComment,
  loadRestaurantComments,
  saveRestaurantComment,
} from "../lib/restaurantComments";

import type { RestaurantComment } from "../lib/restaurantComments";

const RESTAURANT_COMMENT_MODAL_OPEN_EVENT = "restaurant-comment-modal-open";

type RestaurantCommentsButtonProps = {
  kakaoPlaceId: string;
  placeName: string;
  commentCount?: number;

  onCommentCountChange?: (nextCommentCount: number) => void;
};

function getCommentDateText(dateText: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(dateText));
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "한줄평 처리 중 오류가 발생했습니다.";
}

export default function RestaurantCommentsButton({
  kakaoPlaceId,
  placeName,
  commentCount = 0,
  onCommentCountChange,
}: RestaurantCommentsButtonProps) {
  const modalInstanceId = useId();

  const [isOpen, setIsOpen] = useState(false);

  const [comments, setComments] = useState<RestaurantComment[]>([]);

  const [currentCommentCount, setCurrentCommentCount] = useState(commentCount);

  const [commentText, setCommentText] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );

  const [message, setMessage] = useState("");

  useEffect(() => {
    setCurrentCommentCount(commentCount);
  }, [commentCount]);

  useEffect(() => {
    const closeWhenAnotherModalOpens = (event: Event) => {
      const customEvent = event as CustomEvent<string>;

      if (customEvent.detail !== modalInstanceId) {
        setIsOpen(false);
      }
    };

    window.addEventListener(
      RESTAURANT_COMMENT_MODAL_OPEN_EVENT,
      closeWhenAnotherModalOpens,
    );

    return () => {
      window.removeEventListener(
        RESTAURANT_COMMENT_MODAL_OPEN_EVENT,
        closeWhenAnotherModalOpens,
      );
    };
  }, [modalInstanceId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isOpen]);

  const myComment = useMemo(
    () =>
      comments.find(
        (restaurantComment: RestaurantComment) => restaurantComment.isMine,
      ) ?? null,
    [comments],
  );

  const updateCommentCount = (nextCommentCount: number) => {
    setCurrentCommentCount(nextCommentCount);

    onCommentCountChange?.(nextCommentCount);
  };

  const refreshComments = async (): Promise<void> => {
    const nextComments = await loadRestaurantComments(kakaoPlaceId);

    setComments(nextComments);

    updateCommentCount(nextComments.length);

    const nextMyComment =
      nextComments.find(
        (restaurantComment: RestaurantComment) => restaurantComment.isMine,
      ) ?? null;

    setCommentText(nextMyComment?.commentText ?? "");
  };

  const openComments = async (): Promise<void> => {
    window.dispatchEvent(
      new CustomEvent<string>(RESTAURANT_COMMENT_MODAL_OPEN_EVENT, {
        detail: modalInstanceId,
      }),
    );

    setIsOpen(true);
    setIsLoading(true);
    setMessage("");

    try {
      await refreshComments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const closeComments = () => {
    setIsOpen(false);
    setMessage("");
  };

  const saveComment = async (): Promise<void> => {
    const hadExistingComment = myComment !== null;

    try {
      setIsSaving(true);
      setMessage("");

      await saveRestaurantComment(kakaoPlaceId, placeName, commentText);

      await refreshComments();

      setMessage(
        hadExistingComment
          ? "한줄평을 수정했습니다."
          : "한줄평을 등록했습니다.",
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMyComment = async (
    restaurantComment: RestaurantComment,
  ): Promise<void> => {
    const shouldDelete = window.confirm("내 한줄평을 삭제할까요?");

    if (!shouldDelete) {
      return;
    }

    try {
      setDeletingCommentId(restaurantComment.id);

      setMessage("");

      await deleteRestaurantComment(restaurantComment.id);

      await refreshComments();

      setMessage("한줄평을 삭제했습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const modalElement = isOpen ? (
    <div
      className="restaurant-comments-modal-backdrop"
      role="presentation"
      onClick={event => {
        if (event.target === event.currentTarget) {
          closeComments();
        }
      }}
    >
      <section
        className="restaurant-comments-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`restaurant-comments-title-${modalInstanceId}`}
        onClick={event => {
          event.stopPropagation();
        }}
      >
        <div className="restaurant-comments-modal__heading">
          <div>
            <p className="restaurant-comments-modal__eyebrow">TEAM MEMO</p>

            <h2
              className="restaurant-comments-modal__title"
              id={`restaurant-comments-title-${modalInstanceId}`}
            >
              {placeName}
            </h2>

            <p className="restaurant-comments-modal__description">
              팀원들이 남긴 짧은 식당 메모예요.
            </p>
          </div>

          <button
            className="restaurant-comments-modal__close-button"
            type="button"
            onClick={closeComments}
            aria-label="한줄평 창 닫기"
          >
            ×
          </button>
        </div>

        <div className="restaurant-comments-modal__body">
          {isLoading ? (
            <p className="restaurant-comments-modal__empty">
              한줄평을 불러오는 중입니다.
            </p>
          ) : comments.length === 0 ? (
            <p className="restaurant-comments-modal__empty">
              아직 등록된 한줄평이 없습니다.
              <br />첫 번째 메모를 남겨보세요.
            </p>
          ) : (
            <div className="restaurant-comments-list">
              {comments.map((restaurantComment: RestaurantComment) => (
                <article
                  className={`restaurant-comment-item ${
                    restaurantComment.isMine
                      ? "restaurant-comment-item--mine"
                      : ""
                  }`}
                  key={restaurantComment.id}
                >
                  <div className="restaurant-comment-item__heading">
                    <strong>
                      {restaurantComment.isMine ? "내 한줄평" : "익명"}
                    </strong>

                    <span>
                      {getCommentDateText(restaurantComment.updatedAt)}
                    </span>
                  </div>

                  <p className="restaurant-comment-item__text">
                    {restaurantComment.commentText}
                  </p>

                  {restaurantComment.isMine && (
                    <button
                      className="restaurant-comment-item__delete-button"
                      type="button"
                      onClick={() => {
                        void deleteMyComment(restaurantComment);
                      }}
                      disabled={deletingCommentId !== null || isSaving}
                    >
                      {deletingCommentId === restaurantComment.id
                        ? "삭제 중..."
                        : "삭제"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="restaurant-comment-form">
            <label
              className="restaurant-comment-form__label"
              htmlFor={`restaurant-comment-input-${modalInstanceId}`}
            >
              {myComment ? "내 한줄평 수정" : "한줄평 남기기"}
            </label>

            <textarea
              className="restaurant-comment-form__textarea"
              id={`restaurant-comment-input-${modalInstanceId}`}
              value={commentText}
              onChange={event => {
                setCommentText(event.target.value);
              }}
              placeholder="예: 12시 전에 가야 자리가 있어요"
              maxLength={100}
              rows={3}
              disabled={isLoading || isSaving}
            />

            <div className="restaurant-comment-form__footer">
              <span className="restaurant-comment-form__count">
                {commentText.length}/100
              </span>

              <button
                className="restaurant-comment-form__save-button"
                type="button"
                onClick={() => {
                  void saveComment();
                }}
                disabled={
                  isLoading || isSaving || commentText.trim().length === 0
                }
              >
                {isSaving ? "저장 중..." : myComment ? "수정" : "등록"}
              </button>
            </div>
          </div>

          {message && (
            <p className="restaurant-comments-modal__message">{message}</p>
          )}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        className="restaurant-comments-button"
        type="button"
        onClick={event => {
          event.stopPropagation();

          void openComments();
        }}
      >
        한줄평
        {currentCommentCount > 0 && (
          <span className="restaurant-comments-button__count">
            {currentCommentCount}
          </span>
        )}
      </button>

      {modalElement && createPortal(modalElement, document.body)}
    </>
  );
}
