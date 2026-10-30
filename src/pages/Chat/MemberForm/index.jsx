import styles from "./index.module.scss";
import FormItemInput from "../../../components/Form/FormItem/Input";
import FormItemDate from "../../../components/Form/FormItem/Date";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import dayjs from "dayjs";
import FormItemSelect from "../../../components/Form/FormItem/Select";
import { BLOOD_TYPE_OPTIONS, GENDER_OPTIONS } from "../../../enum/form";
import { useAccountStore } from "../../../store/account";
import api from "../../../api";
import { message } from "antd";
import consola from "consola";

/**
 * 新增 / 编辑一位家庭成员。
 *
 * 姓名是一个字段，不拆姓与名：中文姓名没有「名 + 姓」这种拼法，上游把
 * firstName / lastName 用空格拼起来，填「玉坤 赵」得到「玉坤 赵」—— 顺序错、
 * 还多出一个空格。服务端存的本来就是完整 name，这里照原样一个输入框。
 *
 * 传 `member` 就是编辑：字段预填，提交走 /api/custom/members/{id}（上游只能改
 * 「自己」，家人资料由私有补丁接口改）。不传就是新增。
 */
function MemberForm({ onClose, member = null }) {
  const { t } = useTranslation();
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const isEdit = Boolean(member?.id);
  const [formData, setFormData] = useState({
    name: member?.name || member?.nickname || "",
    dateOfBirth: member?.birth ? dayjs(member.birth).format("MM/DD/YYYY") : "",
    gender: member?.gender || "",
    blood: member?.blood || "",
  });

  const [errors, setErrors] = useState({ name: false });
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));
  };

  const validateForm = () => {
    const newErrors = { name: !formData.name.trim() };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const onChangeName = (e) => {
    if (e.target.value.length > 64) return;
    handleFieldChange("name", e.target.value);
  };
  const onChangeDateOfBirth = (value) => {
    handleFieldChange("dateOfBirth", dayjs(value).format("MM/DD/YYYY"));
  };
  const onChangeGender = (option) => handleFieldChange("gender", option.value);
  const onChangeBlood = (option) => handleFieldChange("blood", option.value);

  const translatedGenderOptions = GENDER_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));

  const onClickCancel = () => {
    onClose();
  };

  const onClickSubmit = async () => {
    if (loading) return;
    if (!validateForm()) return;
    setLoading(true);
    try {
      const name = formData.name.trim();
      const birth = formData.dateOfBirth
        ? dayjs(formData.dateOfBirth, "MM/DD/YYYY").format("YYYY-MM-DD")
        : "";
      const gender = formData.gender || "other"; // 后端负责映射成字符串
      const blood = formData.blood || "";

      if (isEdit) {
        await api.updateCustomMember(member.id, { name, gender, birth, blood });
        message.success(t("member_saved"));
      } else {
        await api.createVirtualUser({ name, gender, birth, blood });
        message.success(t("add_member_success", "Member added"));
      }
      onClose();
      fetchBeneficiaryUsers();
    } catch (error) {
      consola.error("ERROR: MemberForm submit", error);
      message.error(isEdit ? t("member_save_failed") : t("add_member_failed", "Failed to add member"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.member_form} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <div className={styles.title}>
          {isEdit ? t("edit_member") : t("add_member")}
        </div>
        {!isEdit && <div className={styles.desc}>{t("add_member_desc")}</div>}
      </div>
      <div className={styles.content}>
        <FormItemInput
          label={t("full_name")}
          required
          onChange={onChangeName}
          value={formData.name}
          error={errors.name}
          errorMessage={t("form_error_required")}
        />
        <FormItemDate
          label={t("date_of_birth")}
          onChange={onChangeDateOfBirth}
          value={formData.dateOfBirth}
        />
        <FormItemSelect
          label={t("gender")}
          onChange={onChangeGender}
          value={formData.gender}
          options={translatedGenderOptions}
        />
        <FormItemSelect
          label={t("blood_type")}
          onChange={onChangeBlood}
          value={formData.blood}
          options={BLOOD_TYPE_OPTIONS}
        />
      </div>
      <div className={styles.footer}>
        <div className={styles.btn_cancel} onClick={onClickCancel}>
          {t("cancel_btn")}
        </div>
        <div className={styles.btn_submit} onClick={onClickSubmit}>
          {loading ? t("settings_saving") : t("submit_btn")}
        </div>
      </div>
    </div>
  );
}

export default MemberForm;
