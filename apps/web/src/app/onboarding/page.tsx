'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Check, ArrowRight, ArrowLeft, Building2, Globe, Coins, Receipt, Loader2 } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Country } from '@padupos/types';

type BusinessType = 'RETAIL' | 'FOOD_AND_BEVERAGE' | 'SERVICES' | 'LAUNDRY' | 'BEAUTY' | 'WHOLESALE' | 'ECOMMERCE' | 'PADUPOSROFESSIONAL_SERVICES' | 'OTHER';

interface OnboardingForm {
  name: string;
  legalName: string;
  businessType: BusinessType | '';
  countryCode: string;
  currency: string;
  locale: string;
  timezone: string;
  fiscalYearStartMonth: number;
  taxId: string;
  initialBranchName: string;
}

interface FormErrors {
  [key: string]: string | undefined;
}

const BUSINESS_TYPADUPOSES: SelectOption[] = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'FOOD_AND_BEVERAGE', label: 'Food & Beverage' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'BEAUTY', label: 'Beauty' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'PADUPOSROFESSIONAL_SERVICES', label: 'PADUPOSrofessional Services' },
  { value: 'OTHER', label: 'Other' },
];

const MONTH_OPADUPOSTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(0, i).toLocaleString('en-US', { month: 'long' }),
}));

const TAX_SYSTEMS: Record<string, string> = {
  ID: 'VAT',
  SG: 'GST',
  MY: 'SALES_TAX',
  US: 'SALES_TAX',
  GB: 'VAT',
  AU: 'GST',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { status, businesses, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<OnboardingForm>({
    name: '',
    legalName: '',
    businessType: '',
    countryCode: '',
    currency: '',
    locale: '',
    timezone: '',
    fiscalYearStartMonth: 1,
    taxId: '',
    initialBranchName: 'Main Branch',
  });

  const steps = [
    { title: 'Business Identity', icon: Building2, description: 'Name and business type' },
    { title: 'Location', icon: Globe, description: 'Country and localization' },
    { title: 'Currency & Time', icon: Coins, description: 'Currency and timezone' },
    { title: 'Tax & Branch', icon: Receipt, description: 'Tax and branch setup' },
    { title: 'Review', icon: Check, description: 'Confirm and complete' },
  ];

  useEffect(() => {
    if (status === 'authenticated' && businesses.length > 0) {
      router.push('/app/dashboard');
      return;
    }
  }, [status, businesses, router]);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await api.get<{ countries: Country[] }>('/countries');
        if (res.data?.countries) {
          setCountries(res.data.countries.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error('Failed to load countries:', err);
      } finally {
        setLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  const updateField = (field: keyof OnboardingForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find((c) => c.countryCode === countryCode);
    if (country) {
      updateField('countryCode', countryCode);
      updateField('currency', country.defaultCurrency);
      updateField('locale', country.defaultLocale);
      updateField('timezone', country.defaultTimezone);
    } else {
      updateField('countryCode', countryCode);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};
    if (step === 0) {
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        newErrors.name = 'Business name must be at least 2 characters';
      }
      if (!formData.businessType) {
        newErrors.businessType = 'PADUPOSlease select a business type';
      }
    } else if (step === 1) {
      if (!formData.countryCode) {
        newErrors.countryCode = 'PADUPOSlease select a country';
      }
    } else if (step === 2) {
      if (!formData.currency) {
        newErrors.currency = 'PADUPOSlease select a currency';
      }
      if (!formData.timezone.trim()) {
        newErrors.timezone = 'Timezone is required';
      }
    } else if (step === 3) {
      if (!formData.initialBranchName.trim() || formData.initialBranchName.trim().length < 2) {
        newErrors.initialBranchName = 'Branch name must be at least 2 characters';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setSubmitting(true);
    setErrors({});
    try {
      const payload = {
        name: formData.name.trim(),
        legalName: formData.legalName.trim() || undefined,
        businessType: formData.businessType as BusinessType,
        countryCode: formData.countryCode,
        currency: formData.currency,
        locale: formData.locale,
        timezone: formData.timezone,
        fiscalYearStartMonth: formData.fiscalYearStartMonth,
        taxId: formData.taxId.trim() || undefined,
        initialBranchName: formData.initialBranchName.trim(),
      };
      const res = await api.post('/auth/onboarding', payload);
      if (res.error) {
        setErrors({ submit: res.error.message || 'Failed to create business' });
        setSubmitting(false);
        return;
      }
      await refreshProfile();
      router.push('/app/dashboard');
    } catch (err: any) {
      setErrors({ submit: err.message || 'An unexpected error occurred' });
      setSubmitting(false);
    }
  };

  return (<div>Onboarding</div>);
}

