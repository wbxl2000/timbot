import { ref } from "vue";

const isChatSettingOpen = ref(false);
const isSearchOpen = ref(false);

function setIsChatSettingOpen(isOpen: boolean) {
  isChatSettingOpen.value = isOpen;
}

function setIsSearchOpen(isOpen: boolean) {
  isSearchOpen.value = isOpen;
}

function useComponentOpenStore() {
  return {
    isChatSettingOpen,
    setIsChatSettingOpen,
    isSearchOpen,
    setIsSearchOpen,
  }
}

export {
  useComponentOpenStore,
};
