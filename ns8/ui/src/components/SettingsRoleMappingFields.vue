<template>
  <div>
    <h4 class="section-heading">
      {{ $t("settings.group_mapping_section") }}
    </h4>
    <p class="section-description">
      {{ $t("settings.group_mapping_description") }}
    </p>
    <NsTextInput
      :value="ldapAdminGroup"
      @input="$emit('update:ldapAdminGroup', $event.trim())"
      :label="$t('settings.ldap_admin_group')"
      :placeholder="$t('settings.ldap_admin_group_placeholder')"
      :invalid-message="error.ldap_admin_group"
      :disabled="disabled"
    />
    <NsTextInput
      :value="ldapPoGroup"
      @input="$emit('update:ldapPoGroup', $event.trim())"
      :label="$t('settings.ldap_po_group')"
      :placeholder="$t('settings.ldap_po_group_placeholder')"
      :invalid-message="error.ldap_po_group"
      :disabled="disabled"
    />
    <NsTextInput
      :value="ldapSmGroup"
      @input="$emit('update:ldapSmGroup', $event.trim())"
      :label="$t('settings.ldap_sm_group')"
      :placeholder="$t('settings.ldap_sm_group_placeholder')"
      :invalid-message="error.ldap_sm_group"
      :disabled="disabled"
    />

    <h4 class="section-heading">
      {{ $t("settings.local_admin_section") }}
    </h4>
    <NsTextInput
      :value="adminPassword"
      @input="$emit('update:adminPassword', $event)"
      type="password"
      :label="$t('settings.admin_password')"
      :placeholder="$t('settings.admin_password_placeholder')"
      :helper-text="$t('settings.admin_password_helper')"
      :password-show-label="$t('settings.show_password')"
      :password-hide-label="$t('settings.hide_password')"
      :invalid-message="error.admin_password"
      :disabled="disabled"
      ref="admin_password"
    />
  </div>
</template>

<script>
export default {
  name: "SettingsRoleMappingFields",
  components: {},
  props: {
    ldapAdminGroup: { type: String, default: "" },
    ldapPoGroup: { type: String, default: "" },
    ldapSmGroup: { type: String, default: "" },
    adminPassword: { type: String, default: "" },
    error: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.section-heading {
  margin-top: $spacing-06;
  margin-bottom: $spacing-04;
}

.section-description {
  font-size: 0.875rem;
  margin-bottom: $spacing-05;
  opacity: 0.85;
}
</style>
